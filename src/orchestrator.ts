import path from "node:path";
import { createUnifiedDiff } from "./diff.js";
import { applyUnifiedPatch } from "./patch.js";
import { parseJsonObject } from "./json.js";
import type { ApprovalProvider } from "./approval.js";
import { intakeMessages, plannerMessages, reviewerMessages, workerMessages } from "./prompts.js";
import type { OllamaClient } from "./ollamaClient.js";
import { runTestCommand, type TestCommandRunner } from "./testCommand.js";
import type { IntakeOutput, PlannerOutput, PreparedEdit, ReviewerOutput, TestCommandResult, WorkerOutput } from "./types.js";
import { validateIntakeOutput, validatePlannerOutput, validateReviewerOutput, validateWorkerOutput } from "./validation.js";
import { Workspace } from "./workspace.js";

export interface RunOptions {
  workspacePath: string;
  task: string;
  model: string;
  approval: ApprovalProvider;
  logger?: Pick<Console, "log" | "error">;
  client: OllamaClient;
  dryRun?: boolean;
  maxReviewRetries?: number;
  testCommand?: string;
  testRunner?: TestCommandRunner;
}

export interface RunResult {
  intake: IntakeOutput;
  planner?: PlannerOutput;
  worker?: WorkerOutput;
  reviewer?: ReviewerOutput;
  workerAttempts: WorkerOutput[];
  reviewerAttempts: ReviewerOutput[];
  applied: string[];
  rejected: string[];
  dryRun: boolean;
  testResult?: TestCommandResult;
  stoppedReason?: string;
}

export async function runOrchestrator(options: RunOptions): Promise<RunResult> {
  const logger = options.logger ?? console;
  const workspace = await Workspace.open(options.workspacePath);

  logger.log(`Workspace: ${workspace.root}`);
  logger.log(`Model: ${options.model}`);
  logger.log("Intake: collecting file list and search context...");
  const files = await workspace.listFiles();
  const searchQueries = deriveSearchQueries(options.task);
  const searchResults = await workspace.searchText(searchQueries);
  logger.log(`Search: ${searchResults.length} match(es) for ${searchQueries.length} query term(s).`);
  logger.log("Intake: evaluating request clarity and routing...");
  const intake = validateIntakeOutput(parseJsonObject(await options.client.chatJson(intakeMessages(options.task, files, searchResults))));
  logger.log(`Intake summary: ${intake.summary}`);
  logger.log(`Intake risk: ${intake.riskLevel}`);
  for (const criterion of intake.acceptanceCriteria) {
    logger.log(`Acceptance: ${criterion}`);
  }
  for (const constraint of intake.constraints) {
    logger.log(`Constraint: ${constraint}`);
  }
  if (!intake.ready) {
    for (const question of intake.questions) {
      logger.log(`Question: ${question}`);
    }
    logger.log("Intake did not mark the request ready. No edits will be planned.");
    return {
      intake,
      workerAttempts: [],
      reviewerAttempts: [],
      applied: [],
      rejected: [],
      dryRun: Boolean(options.dryRun),
      stoppedReason: "intake-not-ready"
    };
  }

  const task = intake.normalizedTask || options.task;
  const planner = validatePlannerOutput(parseJsonObject(await options.client.chatJson(plannerMessages(task, files, searchResults))));

  logger.log(`Planner summary: ${planner.summary}`);
  const snapshots = await workspace.readSnapshots(planner.targetFiles);

  const maxReviewRetries = options.maxReviewRetries ?? 1;
  const workerAttempts: WorkerOutput[] = [];
  const reviewerAttempts: ReviewerOutput[] = [];
  let worker: WorkerOutput | undefined;
  let reviewer: ReviewerOutput | undefined;
  let prepared: PreparedEdit[] = [];
  let reviewFeedback = "";

  for (let attempt = 0; attempt <= maxReviewRetries; attempt += 1) {
    const attemptLabel = attempt === 0 ? "initial" : `retry ${attempt}`;
    logger.log(`Worker: requesting proposed file edits (${attemptLabel})...`);
    const instruction = reviewFeedback
      ? `${planner.workerInstruction}\n\nReviewer rejected the previous diff. Address this feedback and return a revised complete edit set:\n${reviewFeedback}`
      : planner.workerInstruction;
    worker = validateWorkerOutput(parseJsonObject(await options.client.chatJson(workerMessages(task, instruction, snapshots))));
    workerAttempts.push(worker);

    prepared = await prepareEdits(workspace, worker.edits);
    if (prepared.length === 0) {
      logger.log("Worker produced no edits.");
    }

    logger.log(`Reviewer: reviewing proposed diff (${attemptLabel})...`);
    const combinedDiff = prepared.map((edit) => edit.diff).join("\n");
    reviewer = validateReviewerOutput(parseJsonObject(await options.client.chatJson(reviewerMessages(task, combinedDiff))));
    reviewerAttempts.push(reviewer);

    logger.log(`Reviewer approved: ${reviewer.approved}`);
    for (const finding of reviewer.findings) {
      logger.log(`Finding: ${finding}`);
    }
    for (const requiredChange of reviewer.requiredChanges) {
      logger.log(`Required change: ${requiredChange}`);
    }

    if (reviewer.approved) {
      break;
    }

    reviewFeedback = [...reviewer.findings, ...reviewer.requiredChanges].join("\n");
    if (attempt < maxReviewRetries) {
      logger.log("Reviewer did not approve the proposed diff. Requesting a revised Worker proposal...");
    }
  }

  if (!worker || !reviewer) {
    throw new Error("Orchestrator did not produce worker and reviewer outputs.");
  }

  if (!reviewer.approved) {
    logger.log("Reviewer did not approve the proposed diff. No edits will be applied.");
    return {
      intake,
      planner,
      worker,
      reviewer,
      workerAttempts,
      reviewerAttempts,
      applied: [],
      rejected: prepared.map((edit) => edit.path),
      dryRun: Boolean(options.dryRun)
    };
  }

  const combinedDiff = prepared.map((edit) => edit.diff).join("\n");
  logger.log("Approved diff:");
  logger.log(combinedDiff || "(no diff)");

  if (options.dryRun) {
    logger.log("Dry run enabled. No edits will be applied.");
    const testResult = await maybeRunTestCommand(options, workspace.root, logger);
    return {
      intake,
      planner,
      worker,
      reviewer,
      workerAttempts,
      reviewerAttempts,
      applied: [],
      rejected: prepared.map((edit) => edit.path),
      dryRun: true,
      testResult
    };
  }

  const applied: string[] = [];
  const rejected: string[] = [];
  const decision = await options.approval(prepared);
  if (decision === "approve") {
    for (const edit of prepared) {
      await workspace.applyEdit(edit);
      applied.push(edit.path);
    }
  } else {
    rejected.push(...prepared.map((edit) => edit.path));
  }

  const testResult = applied.length > 0 ? await maybeRunTestCommand(options, workspace.root, logger) : undefined;
  logger.log(`Applied: ${applied.length}; Rejected: ${rejected.length}`);
  return { intake, planner, worker, reviewer, workerAttempts, reviewerAttempts, applied, rejected, dryRun: false, testResult };
}

export async function prepareEdits(workspace: Workspace, edits: WorkerOutput["edits"]): Promise<PreparedEdit[]> {
  return Promise.all(
    edits.map(async (edit) => {
      if (edit.action === "delete") {
        throw new Error(`Delete edits are not supported in the initial version: ${edit.path}`);
      }

      const absolutePath = workspace.resolveInside(edit.path);
      const snapshot = await workspace.readSnapshot(edit.path);
      const afterContent = edit.patch && edit.content === undefined ? applyUnifiedPatch(snapshot.content, edit.patch) : edit.content ?? "";
      const normalizedPath = edit.path.replaceAll("\\", "/");

      return {
        ...edit,
        path: normalizedPath,
        content: afterContent,
        absolutePath,
        beforeContent: snapshot.content,
        afterContent,
        diff: createUnifiedDiff(normalizedPath, snapshot.content, afterContent)
      };
    })
  );
}

export function formatWorkspacePathForDisplay(workspacePath: string): string {
  return path.resolve(workspacePath);
}

export function deriveSearchQueries(task: string): string[] {
  const quoted = [...task.matchAll(/["'`](.*?)["'`]/g)].map((match) => match[1] ?? "");
  const words = task
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !commonTaskWords.has(word.toLowerCase()));
  return [...new Set([...quoted, ...words])].slice(0, 12);
}

const commonTaskWords = new Set([
  "add",
  "change",
  "create",
  "delete",
  "edit",
  "file",
  "fix",
  "make",
  "remove",
  "replace",
  "set",
  "the",
  "this",
  "to",
  "update"
]);

async function maybeRunTestCommand(
  options: RunOptions,
  workspaceRoot: string,
  logger: Pick<Console, "log" | "error">
): Promise<TestCommandResult | undefined> {
  if (!options.testCommand) {
    return undefined;
  }
  const runner = options.testRunner ?? runTestCommand;
  return runner(options.testCommand, workspaceRoot, logger);
}

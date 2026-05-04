import path from "node:path";
import { createUnifiedDiff } from "./diff.js";
import { parseJsonObject } from "./json.js";
import type { ApprovalProvider } from "./approval.js";
import { plannerMessages, reviewerMessages, workerMessages } from "./prompts.js";
import type { OllamaClient } from "./ollamaClient.js";
import type { PlannerOutput, PreparedEdit, ReviewerOutput, WorkerOutput } from "./types.js";
import { validatePlannerOutput, validateReviewerOutput, validateWorkerOutput } from "./validation.js";
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
}

export interface RunResult {
  planner: PlannerOutput;
  worker: WorkerOutput;
  reviewer: ReviewerOutput;
  workerAttempts: WorkerOutput[];
  reviewerAttempts: ReviewerOutput[];
  applied: string[];
  rejected: string[];
  dryRun: boolean;
}

export async function runOrchestrator(options: RunOptions): Promise<RunResult> {
  const logger = options.logger ?? console;
  const workspace = await Workspace.open(options.workspacePath);

  logger.log(`Workspace: ${workspace.root}`);
  logger.log(`Model: ${options.model}`);
  logger.log("Planner: collecting file list and creating work plan...");
  const files = await workspace.listFiles();
  const planner = validatePlannerOutput(parseJsonObject(await options.client.chatJson(plannerMessages(options.task, files))));

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
    worker = validateWorkerOutput(parseJsonObject(await options.client.chatJson(workerMessages(options.task, instruction, snapshots))));
    workerAttempts.push(worker);

    prepared = await prepareEdits(workspace, worker.edits);
    if (prepared.length === 0) {
      logger.log("Worker produced no edits.");
    }

    logger.log(`Reviewer: reviewing proposed diff (${attemptLabel})...`);
    const combinedDiff = prepared.map((edit) => edit.diff).join("\n");
    reviewer = validateReviewerOutput(parseJsonObject(await options.client.chatJson(reviewerMessages(options.task, combinedDiff))));
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
    return {
      planner,
      worker,
      reviewer,
      workerAttempts,
      reviewerAttempts,
      applied: [],
      rejected: prepared.map((edit) => edit.path),
      dryRun: true
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

  logger.log(`Applied: ${applied.length}; Rejected: ${rejected.length}`);
  return { planner, worker, reviewer, workerAttempts, reviewerAttempts, applied, rejected, dryRun: false };
}

export async function prepareEdits(workspace: Workspace, edits: WorkerOutput["edits"]): Promise<PreparedEdit[]> {
  return Promise.all(
    edits.map(async (edit) => {
      if (edit.action === "delete") {
        throw new Error(`Delete edits are not supported in the initial version: ${edit.path}`);
      }

      const absolutePath = workspace.resolveInside(edit.path);
      const snapshot = await workspace.readSnapshot(edit.path);
      const afterContent = edit.content ?? "";
      const normalizedPath = edit.path.replaceAll("\\", "/");

      return {
        ...edit,
        path: normalizedPath,
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

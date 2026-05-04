import path from "node:path";
import { createUnifiedDiff } from "./diff.js";
import { parseJsonObject } from "./json.js";
import type { ApprovalProvider, ApprovalDecision } from "./approval.js";
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
}

export interface RunResult {
  planner: PlannerOutput;
  worker: WorkerOutput;
  reviewer: ReviewerOutput;
  applied: string[];
  rejected: string[];
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

  logger.log("Worker: requesting proposed file edits...");
  const worker = validateWorkerOutput(
    parseJsonObject(await options.client.chatJson(workerMessages(options.task, planner.workerInstruction, snapshots)))
  );

  const prepared = await prepareEdits(workspace, worker.edits);
  if (prepared.length === 0) {
    logger.log("Worker produced no edits.");
  }

  logger.log("Reviewer: reviewing proposed diff...");
  const combinedDiff = prepared.map((edit) => edit.diff).join("\n");
  const reviewer = validateReviewerOutput(parseJsonObject(await options.client.chatJson(reviewerMessages(options.task, combinedDiff))));

  logger.log(`Reviewer approved: ${reviewer.approved}`);
  for (const finding of reviewer.findings) {
    logger.log(`Finding: ${finding}`);
  }
  for (const requiredChange of reviewer.requiredChanges) {
    logger.log(`Required change: ${requiredChange}`);
  }

  if (!reviewer.approved) {
    logger.log("Reviewer did not approve the proposed diff. No edits will be applied.");
    return { planner, worker, reviewer, applied: [], rejected: prepared.map((edit) => edit.path) };
  }

  const applied: string[] = [];
  const rejected: string[] = [];
  for (const edit of prepared) {
    const decision = await options.approval(edit);
    if (decision === "quit") {
      rejected.push(edit.path);
      break;
    }
    if (decision === "approve") {
      await workspace.applyEdit(edit);
      applied.push(edit.path);
    } else {
      rejected.push(edit.path);
    }
  }

  logger.log(`Applied: ${applied.length}; Rejected: ${rejected.length}`);
  return { planner, worker, reviewer, applied, rejected };
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

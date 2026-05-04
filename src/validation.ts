import { assertString, assertStringArray } from "./json.js";
import type { PlannerOutput, ReviewerOutput, WorkerOutput } from "./types.js";

export function validatePlannerOutput(value: unknown): PlannerOutput {
  const record = asRecord(value, "planner output");
  return {
    summary: assertString(record.summary, "summary"),
    targetFiles: assertStringArray(record.targetFiles, "targetFiles"),
    workerInstruction: assertString(record.workerInstruction, "workerInstruction"),
    verification: assertStringArray(record.verification, "verification")
  };
}

export function validateWorkerOutput(value: unknown): WorkerOutput {
  const record = asRecord(value, "worker output");
  if (!Array.isArray(record.edits)) {
    throw new Error("edits must be an array.");
  }

  return {
    summary: assertString(record.summary, "summary"),
    edits: record.edits.map((edit, index) => {
      const item = asRecord(edit, `edits[${index}]`);
      const action = assertString(item.action, `edits[${index}].action`);
      if (action !== "create" && action !== "update" && action !== "delete") {
        throw new Error(`edits[${index}].action must be create, update, or delete.`);
      }

      const content = item.content === undefined ? undefined : assertString(item.content, `edits[${index}].content`);
      if ((action === "create" || action === "update") && content === undefined) {
        throw new Error(`edits[${index}].content is required for ${action}.`);
      }

      return {
        path: assertString(item.path, `edits[${index}].path`),
        action,
        reason: assertString(item.reason, `edits[${index}].reason`),
        content
      };
    })
  };
}

export function validateReviewerOutput(value: unknown): ReviewerOutput {
  const record = asRecord(value, "reviewer output");
  if (typeof record.approved !== "boolean") {
    throw new Error("approved must be a boolean.");
  }

  return {
    approved: record.approved,
    findings: assertStringArray(record.findings, "findings"),
    requiredChanges: assertStringArray(record.requiredChanges, "requiredChanges")
  };
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

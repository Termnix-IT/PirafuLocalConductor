import { assertString, assertStringArray } from "./json.js";
import type { IntakeOutput, PlannerOutput, ReviewerOutput, WorkerOutput } from "./types.js";

export function validateIntakeOutput(value: unknown): IntakeOutput {
  const record = asRecord(value, "intake output");
  if (typeof record.ready !== "boolean") {
    throw new Error("ready must be a boolean.");
  }
  const riskLevel = assertString(record.riskLevel, "riskLevel");
  if (riskLevel !== "low" && riskLevel !== "medium" && riskLevel !== "high") {
    throw new Error("riskLevel must be low, medium, or high.");
  }

  return {
    ready: record.ready,
    summary: assertString(record.summary, "summary"),
    normalizedTask: assertString(record.normalizedTask, "normalizedTask"),
    acceptanceCriteria: assertStringOrStringArray(record.acceptanceCriteria, "acceptanceCriteria"),
    constraints: assertStringOrStringArray(record.constraints, "constraints"),
    questions: assertStringOrStringArray(record.questions, "questions"),
    riskLevel
  };
}

export function validatePlannerOutput(value: unknown): PlannerOutput {
  const record = asRecord(value, "planner output");
  return {
    summary: assertString(record.summary, "summary"),
    targetFiles: assertStringArray(record.targetFiles, "targetFiles"),
    workerInstruction: assertString(record.workerInstruction, "workerInstruction"),
    verification: assertStringOrStringArray(record.verification, "verification")
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
      const patch = item.patch === undefined ? undefined : assertString(item.patch, `edits[${index}].patch`);
      if (action === "create" && content === undefined) {
        throw new Error(`edits[${index}].content is required for create.`);
      }
      if (action === "update" && content === undefined && patch === undefined) {
        throw new Error(`edits[${index}] requires content or patch for update.`);
      }

      return {
        path: assertString(item.path, `edits[${index}].path`),
        action,
        reason: assertString(item.reason, `edits[${index}].reason`),
        content,
        patch
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

function assertStringOrStringArray(value: unknown, name: string): string[] {
  if (typeof value === "string") {
    return value.trim().length > 0 ? [value] : [];
  }
  return assertStringArray(value, name);
}

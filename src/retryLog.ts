export interface RetryRunOptions {
  task: string;
  workspace: string;
  model: string;
}

export function extractRetryRunOptions(value: unknown, fallbackModel: string): RetryRunOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Run log must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const task = readString(record.task, "task");
  const workspace = readString(record.workspace, "workspace");
  const model = typeof record.model === "string" && record.model.length > 0 ? record.model : fallbackModel;
  return { task, workspace, model };
}

function readString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Run log is missing ${name}.`);
  }
  return value;
}

export const intakeSchema = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    summary: { type: "string" },
    normalizedTask: { type: "string" },
    acceptanceCriteria: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] }
  },
  required: ["ready", "summary", "normalizedTask", "acceptanceCriteria", "constraints", "questions", "riskLevel"],
  additionalProperties: false
} as const;

export const plannerSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    targetFiles: { type: "array", items: { type: "string" } },
    workerInstruction: { type: "string" },
    verification: { type: "array", items: { type: "string" } }
  },
  required: ["summary", "targetFiles", "workerInstruction", "verification"],
  additionalProperties: false
} as const;

export const workerSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          action: { type: "string", enum: ["create", "update", "delete"] },
          reason: { type: "string" },
          content: { type: "string" },
          patch: { type: "string" }
        },
        required: ["path", "action", "reason"],
        additionalProperties: false
      }
    }
  },
  required: ["summary", "edits"],
  additionalProperties: false
} as const;

export const reviewerSchema = {
  type: "object",
  properties: {
    approved: { type: "boolean" },
    findings: { type: "array", items: { type: "string" } },
    requiredChanges: { type: "array", items: { type: "string" } }
  },
  required: ["approved", "findings", "requiredChanges"],
  additionalProperties: false
} as const;

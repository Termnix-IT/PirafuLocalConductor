import type { FileSnapshot } from "./types.js";

export function plannerMessages(task: string, files: string[]) {
  return [
    {
      role: "system" as const,
      content: [
        "You are Planner, the planning agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"summary\":\"string\",\"targetFiles\":[\"relative/path\"],\"workerInstruction\":\"string\",\"verification\":[\"string\"]}.",
        "Select a small set of likely target files from the file list. Include new relative paths when needed.",
        "Never use absolute paths."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, files }, null, 2)
    }
  ];
}

export function workerMessages(task: string, instruction: string, snapshots: FileSnapshot[]) {
  return [
    {
      role: "system" as const,
      content: [
        "You are Worker, the editing agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"summary\":\"string\",\"edits\":[{\"path\":\"relative/path\",\"action\":\"create|update|delete\",\"reason\":\"string\",\"content\":\"full file content for create/update\"}]}",
        "Use only relative paths. Do not emit absolute paths.",
        "Prefer create and update. Delete is reserved for files that are clearly obsolete.",
        "For update, content must be the complete replacement file content."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, instruction, files: snapshots }, null, 2)
    }
  ];
}

export function reviewerMessages(task: string, diff: string) {
  return [
    {
      role: "system" as const,
      content: [
        "You are Reviewer, the review agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"approved\":boolean,\"findings\":[\"string\"],\"requiredChanges\":[\"string\"]}.",
        "Focus on dangerous file operations, missed requirements, and test gaps."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, diff }, null, 2)
    }
  ];
}

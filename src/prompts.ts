import type { FileSnapshot, SearchResult } from "./types.js";

export function intakeMessages(task: string, files: string[], searchResults: SearchResult[]) {
  return [
    {
      role: "system" as const,
      content: [
        "You are Intake, the front desk agent for a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"ready\":boolean,\"summary\":\"string\",\"normalizedTask\":\"string\",\"acceptanceCriteria\":[\"string\"],\"constraints\":[\"string\"],\"questions\":[\"string\"],\"riskLevel\":\"low|medium|high\"}.",
        "Decide whether the request is clear enough for a coding agent to edit files safely.",
        "Set ready=false only when a reasonable implementation cannot be inferred safely.",
        "When ready=true, rewrite normalizedTask as a concise actionable request for Planner.",
        "Use relative paths only when mentioning files. Never invent absolute paths."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, files, searchResults }, null, 2)
    }
  ];
}

export function plannerMessages(task: string, files: string[], searchResults: SearchResult[]) {
  return [
    {
      role: "system" as const,
      content: [
        "You are Planner, the planning agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"summary\":\"string\",\"targetFiles\":[\"relative/path\"],\"workerInstruction\":\"string\",\"verification\":[\"string\"]}.",
        "Use searchResults as stronger evidence than file names when selecting targetFiles.",
        "Select a small set of likely target files from the file list. Include new relative paths when needed.",
        "Never use absolute paths."
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, files, searchResults }, null, 2)
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
        "Schema: {\"summary\":\"string\",\"edits\":[{\"path\":\"relative/path\",\"action\":\"create|update|delete\",\"reason\":\"string\",\"content\":\"full file content for create/update\",\"patch\":\"unified diff for update\"}]}",
        "Use only relative paths. Do not emit absolute paths.",
        "Prefer create and update. Delete is reserved for files that are clearly obsolete.",
        "For update, prefer patch when the change is small. Use content when creating files or when full replacement is safer.",
        "Do not provide both content and patch for the same edit unless content is the authoritative full replacement."
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

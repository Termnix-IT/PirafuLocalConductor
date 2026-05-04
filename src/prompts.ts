import type { FileSnapshot, ResponseLanguage, SearchResult } from "./types.js";

export function intakeMessages(task: string, files: string[], searchResults: SearchResult[], language: ResponseLanguage = "en") {
  return [
    {
      role: "system" as const,
      content: [
        "You are Intake, the front desk agent for a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"ready\":boolean,\"summary\":\"string\",\"normalizedTask\":\"string\",\"acceptanceCriteria\":[\"string\"],\"constraints\":[\"string\"],\"questions\":[\"string\"],\"riskLevel\":\"low|medium|high\"}.",
        "Decide whether the request is clear enough for a coding agent to edit files safely.",
        "Set ready=false only when a reasonable implementation cannot be inferred safely.",
        "Do not expand, redesign, or add features beyond the user's explicit task.",
        "When ready=true, normalizedTask must preserve the user's exact intent and requested filenames. Only clarify wording, do not add requirements.",
        "Acceptance criteria must be directly implied by the user's task, not invented.",
        "Put assumptions in constraints only when they are necessary and minimal.",
        "Use relative paths only when mentioning files. Never invent absolute paths.",
        languageInstruction(language)
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, files, searchResults }, null, 2)
    }
  ];
}

export function plannerMessages(task: string, files: string[], searchResults: SearchResult[], language: ResponseLanguage = "en") {
  return [
    {
      role: "system" as const,
      content: [
        "You are Planner, the planning agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"summary\":\"string\",\"targetFiles\":[\"relative/path\"],\"workerInstruction\":\"string\",\"verification\":[\"string\"]}.",
        "Do not broaden the task. Preserve filenames and scope from the task.",
        "Use searchResults as stronger evidence than file names when selecting targetFiles.",
        "Select a small set of likely target files from the file list. Include new relative paths when needed.",
        "Never use absolute paths.",
        languageInstruction(language)
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, files, searchResults }, null, 2)
    }
  ];
}

export function workerMessages(task: string, instruction: string, snapshots: FileSnapshot[], language: ResponseLanguage = "en") {
  return [
    {
      role: "system" as const,
      content: [
        "You are Worker, the editing agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"summary\":\"string\",\"edits\":[{\"path\":\"relative/path\",\"action\":\"create|update|delete\",\"reason\":\"string\",\"content\":\"full file content for create/update\",\"patch\":\"unified diff for update\"}]}",
        "Implement only the requested task. Do not substitute examples unrelated to the requested operation.",
        "Use only relative paths. Do not emit absolute paths.",
        "Prefer create and update. Delete is reserved for files that are clearly obsolete.",
        "For update, prefer patch when the change is small. Use content when creating files or when full replacement is safer.",
        "Do not provide both content and patch for the same edit unless content is the authoritative full replacement.",
        "When generating source code, keep runtime user-facing output strings, print/error/usage/help text, sample printed text, and CLI messages ASCII-only unless the user explicitly requests non-ASCII output.",
        "Code comments may follow the selected response language, but strings printed or shown by generated programs must remain ASCII-only by default.",
        languageInstruction(language)
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, instruction, files: snapshots }, null, 2)
    }
  ];
}

export function reviewerMessages(task: string, diff: string, language: ResponseLanguage = "en") {
  return [
    {
      role: "system" as const,
      content: [
        "You are Reviewer, the review agent in a local coding orchestrator.",
        "Return only JSON.",
        "Schema: {\"approved\":boolean,\"findings\":[\"string\"],\"requiredChanges\":[\"string\"]}.",
        "Focus on dangerous file operations, missed requirements, and test gaps.",
        "Reject generated source code that contains non-ASCII runtime output strings, print/error/usage/help text, or CLI messages unless the user explicitly requested non-ASCII output.",
        languageInstruction(language)
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({ task, diff }, null, 2)
    }
  ];
}

function languageInstruction(language: ResponseLanguage): string {
  return language === "ja"
    ? "Write human-facing JSON string values in Japanese. Keep code, paths, commands, and identifiers in their original language."
    : "Write human-facing JSON string values in English. Keep code, paths, commands, and identifiers in their original language.";
}

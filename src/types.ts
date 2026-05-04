export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface PlannerOutput {
  summary: string;
  targetFiles: string[];
  workerInstruction: string;
  verification: string[];
}

export type EditAction = "create" | "update" | "delete";

export interface ProposedEdit {
  path: string;
  action: EditAction;
  reason: string;
  content?: string;
}

export interface WorkerOutput {
  summary: string;
  edits: ProposedEdit[];
}

export interface ReviewerOutput {
  approved: boolean;
  findings: string[];
  requiredChanges: string[];
}

export interface FileSnapshot {
  path: string;
  exists: boolean;
  content: string;
}

export interface SearchResult {
  path: string;
  line: number;
  preview: string;
  query: string;
}

export interface PreparedEdit extends ProposedEdit {
  absolutePath: string;
  beforeContent: string;
  afterContent: string;
  diff: string;
}

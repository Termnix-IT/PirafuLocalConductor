import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { PreparedEdit } from "./types.js";

export type ApprovalDecision = "approve" | "reject" | "quit";
export type ApprovalProvider = (edits: PreparedEdit[]) => Promise<ApprovalDecision>;

export function createInteractiveApproval(): ApprovalProvider {
  return async (edits) => {
    for (const edit of edits) {
      output.write(`\n${edit.diff}\nReason: ${edit.reason}\n`);
    }

    const rl = readline.createInterface({ input, output });
    try {
      const fileList = edits.map((edit) => edit.path).join(", ");
      const answer = (await rl.question(`Apply all ${edits.length} proposed edit(s) (${fileList})? [y/N/q] `)).trim().toLowerCase();
      if (answer === "y" || answer === "yes") {
        return "approve";
      }
      if (answer === "q" || answer === "quit") {
        return "quit";
      }
      return "reject";
    } finally {
      rl.close();
    }
  };
}

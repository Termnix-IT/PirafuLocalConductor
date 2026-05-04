import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { PreparedEdit } from "./types.js";

export type ApprovalDecision = "approve" | "reject" | "quit";
export type ApprovalProvider = (edit: PreparedEdit) => Promise<ApprovalDecision>;

export function createInteractiveApproval(): ApprovalProvider {
  return async (edit) => {
    output.write(`\n${edit.diff}\nReason: ${edit.reason}\n`);
    const rl = readline.createInterface({ input, output });
    try {
      const answer = (await rl.question(`Apply ${edit.action} to ${edit.path}? [y/N/q] `)).trim().toLowerCase();
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

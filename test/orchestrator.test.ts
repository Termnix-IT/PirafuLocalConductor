import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import type { ChatMessage } from "../src/types.js";
import { runOrchestrator } from "../src/orchestrator.js";
import type { ApprovalProvider } from "../src/approval.js";

class FakeClient {
  private calls = 0;
  constructor(private readonly reviewerApproved = true) {}

  async chatJson(_messages: ChatMessage[]): Promise<string> {
    this.calls += 1;
    if (this.calls === 1) {
      return JSON.stringify({
        summary: "Update file",
        targetFiles: ["index.ts"],
        workerInstruction: "Change value to 2.",
        verification: ["Read file"]
      });
    }
    if (this.calls === 2) {
      return JSON.stringify({
        summary: "Changed file",
        edits: [{ path: "index.ts", action: "update", reason: "requested", content: "export const value = 2;\n" }]
      });
    }
    return JSON.stringify({
      approved: this.reviewerApproved,
      findings: this.reviewerApproved ? [] : ["unsafe"],
      requiredChanges: this.reviewerApproved ? [] : ["revise diff"]
    });
  }
}

export async function testOrchestratorAppliesOnlyApprovedEdits(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => "reject";

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new FakeClient() as never,
      approval,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.rejected, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testOrchestratorBlocksUnapprovedReview(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => {
      throw new Error("approval should not be requested after a failed review");
    };

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new FakeClient(false) as never,
      approval,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.rejected, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import type { ChatMessage } from "../src/types.js";
import { deriveSearchQueries, runOrchestrator } from "../src/orchestrator.js";
import type { ApprovalProvider } from "../src/approval.js";
import type { TestCommandRunner } from "../src/testCommand.js";

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

class RetryClient {
  private calls = 0;

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
        summary: "Bad change",
        edits: [{ path: "index.ts", action: "update", reason: "bad", content: "export const value = 99;\n" }]
      });
    }
    if (this.calls === 3) {
      return JSON.stringify({ approved: false, findings: ["wrong value"], requiredChanges: ["use value 2"] });
    }
    if (this.calls === 4) {
      return JSON.stringify({
        summary: "Revised change",
        edits: [{ path: "index.ts", action: "update", reason: "fixed", content: "export const value = 2;\n" }]
      });
    }
    return JSON.stringify({ approved: true, findings: [], requiredChanges: [] });
  }
}

class PatchClient {
  private calls = 0;

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
        summary: "Changed file with patch",
        edits: [
          {
            path: "index.ts",
            action: "update",
            reason: "requested",
            patch: ["@@ -1 +1 @@", "-export const value = 1;", "+export const value = 2;"].join("\n")
          }
        ]
      });
    }
    return JSON.stringify({ approved: true, findings: [], requiredChanges: [] });
  }
}

export async function testOrchestratorAppliesOnlyApprovedEdits(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async (edits) => {
      assert.equal(edits.length, 1);
      return "reject";
    };

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
      maxReviewRetries: 0,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.rejected, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testOrchestratorDryRunSkipsApprovalAndApply(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => {
      throw new Error("approval should not be requested during dry run");
    };

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new FakeClient() as never,
      approval,
      dryRun: true,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.equal(result.dryRun, true);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.rejected, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testOrchestratorRetriesAfterReviewRejection(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => "approve";

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new RetryClient() as never,
      approval,
      maxReviewRetries: 1,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.equal(result.workerAttempts.length, 2);
    assert.equal(result.reviewerAttempts.length, 2);
    assert.deepEqual(result.applied, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 2;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function testDeriveSearchQueriesUsesQuotedStrings(): void {
  assert.deepEqual(deriveSearchQueries("Change message to 'hello gemma4'."), ["hello gemma4", "message", "hello", "gemma4"]);
}

export async function testOrchestratorRunsTestCommandAfterApply(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => "approve";
    const testCalls: string[] = [];
    const testRunner: TestCommandRunner = async (command, cwd) => {
      testCalls.push(`${cwd}:${command}`);
      return { command, exitCode: 0, signal: null, stdout: "ok", stderr: "" };
    };

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new FakeClient() as never,
      approval,
      testCommand: "npm test",
      testRunner,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, ["index.ts"]);
    assert.equal(result.testResult?.exitCode, 0);
    assert.deepEqual(testCalls, [`${root}:npm test`]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testOrchestratorSkipsTestCommandWhenRejected(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => "reject";
    const testRunner: TestCommandRunner = async () => {
      throw new Error("test command should not run when edits are rejected");
    };

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new FakeClient() as never,
      approval,
      testCommand: "npm test",
      testRunner,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, []);
    assert.equal(result.testResult, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testOrchestratorAppliesPatchEdits(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-run-"));
  try {
    await writeFile(path.join(root, "index.ts"), "export const value = 1;\n", "utf8");
    const approval: ApprovalProvider = async () => "approve";

    const result = await runOrchestrator({
      workspacePath: root,
      task: "change value",
      model: "fake",
      client: new PatchClient() as never,
      approval,
      logger: { log: () => undefined, error: () => undefined }
    });

    assert.deepEqual(result.applied, ["index.ts"]);
    assert.equal(await readFile(path.join(root, "index.ts"), "utf8"), "export const value = 2;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

import assert from "node:assert/strict";
import { extractRetryRunOptions } from "../src/retryLog.js";

export function testExtractRetryRunOptionsReadsLogFields(): void {
  assert.deepEqual(
    extractRetryRunOptions(
      {
        task: "change value",
        workspace: "C:/tmp/project",
        model: "gemma4:latest"
      },
      "fallback"
    ),
    {
      task: "change value",
      workspace: "C:/tmp/project",
      model: "gemma4:latest"
    }
  );
}

export function testExtractRetryRunOptionsUsesFallbackModel(): void {
  assert.equal(
    extractRetryRunOptions(
      {
        task: "change value",
        workspace: "C:/tmp/project"
      },
      "gemma4:latest"
    ).model,
    "gemma4:latest"
  );
}

export function testExtractRetryRunOptionsRequiresTaskAndWorkspace(): void {
  assert.throws(() => extractRetryRunOptions({ task: "change value" }, "gemma4:latest"), /workspace/);
}

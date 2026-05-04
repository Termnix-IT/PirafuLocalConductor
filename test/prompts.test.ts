import assert from "node:assert/strict";
import { workerMessages } from "../src/prompts.js";

export function testWorkerPromptRequiresAsciiRuntimeOutput(): void {
  const system = workerMessages("create hikizan.py", "create subtraction script", [], "ja")[0]?.content ?? "";
  assert.match(system, /ASCII-only/);
  assert.match(system, /runtime user-facing output strings/);
}

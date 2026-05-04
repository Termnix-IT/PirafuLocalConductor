import assert from "node:assert/strict";
import { reviewerMessages, workerMessages } from "../src/prompts.js";

export function testWorkerPromptSeparatesCommentsFromRuntimeOutput(): void {
  const system = workerMessages("create script", "create script", [], "ja")[0]?.content ?? "";
  assert.match(system, /Code comments may follow/);
  assert.match(system, /print\/error\/usage\/help text/);
}

export function testReviewerPromptRejectsNonAsciiRuntimeOutput(): void {
  const system = reviewerMessages("create script", "--- diff ---", "ja")[0]?.content ?? "";
  assert.match(system, /Reject generated source code/);
  assert.match(system, /non-ASCII runtime output strings/);
}

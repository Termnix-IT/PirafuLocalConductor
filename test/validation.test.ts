import assert from "node:assert/strict";
import { parseJsonObject } from "../src/json.js";
import { validateIntakeOutput, validateWorkerOutput } from "../src/validation.js";

export function testParseJsonObjectAcceptsFencedJson(): void {
  const value = parseJsonObject<{ ok: boolean }>("```json\n{\"ok\":true}\n```");
  assert.equal(value.ok, true);
}

export function testWorkerValidationRequiresContentOrPatchForUpdate(): void {
  assert.throws(
    () =>
      validateWorkerOutput({
        summary: "bad",
        edits: [{ path: "a.ts", action: "update", reason: "missing content" }]
    }),
    /requires content or patch/
  );
}

export function testIntakeValidationRequiresKnownRiskLevel(): void {
  assert.throws(
    () =>
      validateIntakeOutput({
        ready: true,
        summary: "ok",
        normalizedTask: "change value",
        acceptanceCriteria: [],
        constraints: [],
        questions: [],
        riskLevel: "unknown"
      }),
    /riskLevel/
  );
}

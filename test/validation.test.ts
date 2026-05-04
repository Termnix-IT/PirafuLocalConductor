import assert from "node:assert/strict";
import { parseJsonObject } from "../src/json.js";
import { validateIntakeOutput, validatePlannerOutput, validateWorkerOutput } from "../src/validation.js";

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

export function testIntakeValidationAcceptsSingleStringLists(): void {
  const result = validateIntakeOutput({
    ready: true,
    summary: "ok",
    normalizedTask: "create add script",
    acceptanceCriteria: "script adds numbers",
    constraints: "Python",
    questions: "",
    riskLevel: "low"
  });
  assert.deepEqual(result.acceptanceCriteria, ["script adds numbers"]);
  assert.deepEqual(result.constraints, ["Python"]);
  assert.deepEqual(result.questions, []);
}

export function testPlannerValidationAcceptsSingleVerificationString(): void {
  const result = validatePlannerOutput({
    summary: "plan",
    targetFiles: ["add_numbers.py"],
    workerInstruction: "create script",
    verification: "Run python add_numbers.py"
  });
  assert.deepEqual(result.verification, ["Run python add_numbers.py"]);
}

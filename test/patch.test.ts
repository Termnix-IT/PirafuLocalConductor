import assert from "node:assert/strict";
import { applyUnifiedPatch } from "../src/patch.js";

export function testApplyUnifiedPatchUpdatesMatchingHunk(): void {
  const result = applyUnifiedPatch(
    "export const value = 1;\n",
    [
      "--- a/index.ts",
      "+++ b/index.ts",
      "@@ -1 +1 @@",
      "-export const value = 1;",
      "+export const value = 2;"
    ].join("\n")
  );
  assert.equal(result, "export const value = 2;\n");
}

export function testApplyUnifiedPatchRejectsMismatchedContext(): void {
  assert.throws(
    () =>
      applyUnifiedPatch(
        "export const value = 1;\n",
        [
          "@@ -1 +1 @@",
          "-export const missing = 1;",
          "+export const value = 2;"
        ].join("\n")
      ),
    /Patch context mismatch/
  );
}

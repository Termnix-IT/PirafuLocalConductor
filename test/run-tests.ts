import { testOrchestratorAppliesOnlyApprovedEdits, testOrchestratorBlocksUnapprovedReview } from "./orchestrator.test.js";
import { testParseJsonObjectAcceptsFencedJson, testWorkerValidationRequiresContentForUpdate } from "./validation.test.js";
import { testWorkspaceAppliesCreateEdits, testWorkspaceRejectsEscapingPaths } from "./workspace.test.js";

const tests: Array<[string, () => void | Promise<void>]> = [
  ["workspace rejects absolute and escaping paths", testWorkspaceRejectsEscapingPaths],
  ["workspace applies approved create edits inside root", testWorkspaceAppliesCreateEdits],
  ["parseJsonObject accepts fenced JSON", testParseJsonObjectAcceptsFencedJson],
  ["worker validation requires content for update", testWorkerValidationRequiresContentForUpdate],
  ["orchestrator applies only approved edits", testOrchestratorAppliesOnlyApprovedEdits],
  ["orchestrator blocks unapproved review", testOrchestratorBlocksUnapprovedReview]
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}

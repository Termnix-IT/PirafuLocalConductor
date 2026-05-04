import {
  testOrchestratorAppliesOnlyApprovedEdits,
  testOrchestratorBlocksUnapprovedReview,
  testDeriveSearchQueriesUsesQuotedStrings,
  testOrchestratorDryRunSkipsApprovalAndApply,
  testOrchestratorRetriesAfterReviewRejection
} from "./orchestrator.test.js";
import { testRunLogSavesJsonFile } from "./runLog.test.js";
import { testParseJsonObjectAcceptsFencedJson, testWorkerValidationRequiresContentForUpdate } from "./validation.test.js";
import { testWorkspaceAppliesCreateEdits, testWorkspaceRejectsEscapingPaths, testWorkspaceSearchTextFindsMatches } from "./workspace.test.js";

const tests: Array<[string, () => void | Promise<void>]> = [
  ["workspace rejects absolute and escaping paths", testWorkspaceRejectsEscapingPaths],
  ["workspace applies approved create edits inside root", testWorkspaceAppliesCreateEdits],
  ["workspace search text finds matches", testWorkspaceSearchTextFindsMatches],
  ["parseJsonObject accepts fenced JSON", testParseJsonObjectAcceptsFencedJson],
  ["worker validation requires content for update", testWorkerValidationRequiresContentForUpdate],
  ["derive search queries uses quoted strings", testDeriveSearchQueriesUsesQuotedStrings],
  ["orchestrator applies only approved edits", testOrchestratorAppliesOnlyApprovedEdits],
  ["orchestrator blocks unapproved review", testOrchestratorBlocksUnapprovedReview],
  ["orchestrator dry run skips approval and apply", testOrchestratorDryRunSkipsApprovalAndApply],
  ["orchestrator retries after review rejection", testOrchestratorRetriesAfterReviewRejection],
  ["run log saves JSON file", testRunLogSavesJsonFile]
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

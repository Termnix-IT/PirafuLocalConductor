import {
  testOrchestratorAppliesOnlyApprovedEdits,
  testOrchestratorBlocksUnapprovedReview,
  testDeriveSearchQueriesUsesQuotedStrings,
  testOrchestratorAppliesPatchEdits,
  testOrchestratorDryRunSkipsApprovalAndApply,
  testOrchestratorRunsTestCommandAfterApply,
  testOrchestratorSkipsTestCommandWhenRejected,
  testOrchestratorRetriesAfterReviewRejection
} from "./orchestrator.test.js";
import { testApplyUnifiedPatchRejectsMismatchedContext, testApplyUnifiedPatchUpdatesMatchingHunk } from "./patch.test.js";
import { testRunLogListsAndReadsSavedLogs, testRunLogSavesJsonFile } from "./runLog.test.js";
import {
  testExtractRetryRunOptionsReadsLogFields,
  testExtractRetryRunOptionsRequiresTaskAndWorkspace,
  testExtractRetryRunOptionsUsesFallbackModel
} from "./retryLog.test.js";
import { testParseCommandLineKeepsQuotedArgs, testParseCommandLineRejectsUnclosedQuote } from "./testCommand.test.js";
import { testParseJsonObjectAcceptsFencedJson, testWorkerValidationRequiresContentOrPatchForUpdate } from "./validation.test.js";
import { testWorkspaceAppliesCreateEdits, testWorkspaceRejectsEscapingPaths, testWorkspaceSearchTextFindsMatches } from "./workspace.test.js";

const tests: Array<[string, () => void | Promise<void>]> = [
  ["workspace rejects absolute and escaping paths", testWorkspaceRejectsEscapingPaths],
  ["workspace applies approved create edits inside root", testWorkspaceAppliesCreateEdits],
  ["workspace search text finds matches", testWorkspaceSearchTextFindsMatches],
  ["parseJsonObject accepts fenced JSON", testParseJsonObjectAcceptsFencedJson],
  ["worker validation requires content or patch for update", testWorkerValidationRequiresContentOrPatchForUpdate],
  ["apply unified patch updates matching hunk", testApplyUnifiedPatchUpdatesMatchingHunk],
  ["apply unified patch rejects mismatched context", testApplyUnifiedPatchRejectsMismatchedContext],
  ["parse command line keeps quoted args", testParseCommandLineKeepsQuotedArgs],
  ["parse command line rejects unclosed quote", testParseCommandLineRejectsUnclosedQuote],
  ["derive search queries uses quoted strings", testDeriveSearchQueriesUsesQuotedStrings],
  ["orchestrator applies only approved edits", testOrchestratorAppliesOnlyApprovedEdits],
  ["orchestrator applies patch edits", testOrchestratorAppliesPatchEdits],
  ["orchestrator blocks unapproved review", testOrchestratorBlocksUnapprovedReview],
  ["orchestrator dry run skips approval and apply", testOrchestratorDryRunSkipsApprovalAndApply],
  ["orchestrator retries after review rejection", testOrchestratorRetriesAfterReviewRejection],
  ["orchestrator runs test command after apply", testOrchestratorRunsTestCommandAfterApply],
  ["orchestrator skips test command when rejected", testOrchestratorSkipsTestCommandWhenRejected],
  ["run log saves JSON file", testRunLogSavesJsonFile],
  ["run log lists and reads saved logs", testRunLogListsAndReadsSavedLogs],
  ["extract retry run options reads log fields", testExtractRetryRunOptionsReadsLogFields],
  ["extract retry run options uses fallback model", testExtractRetryRunOptionsUsesFallbackModel],
  ["extract retry run options requires task and workspace", testExtractRetryRunOptionsRequiresTaskAndWorkspace]
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

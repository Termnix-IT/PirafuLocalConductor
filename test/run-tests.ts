import {
  testOrchestratorAppliesOnlyApprovedEdits,
  testOrchestratorBlocksUnapprovedReview,
  testDeriveSearchQueriesUsesQuotedStrings,
  testOrchestratorAppliesPatchEdits,
  testOrchestratorDryRunSkipsApprovalAndApply,
  testOrchestratorRunsTestCommandAfterApply,
  testOrchestratorSkipsTestCommandWhenRejected,
  testOrchestratorRepairsMalformedReviewerJson,
  testOrchestratorStopsWhenIntakeIsNotReady,
  testOrchestratorRetriesAfterReviewRejection
} from "./orchestrator.test.js";
import { testChatLogPathToIdExtractsJsonFileName, testSplitInputLinesNormalizesWindowsNewlines } from "./chat.test.js";
import { testApplyUnifiedPatchRejectsMismatchedContext, testApplyUnifiedPatchUpdatesMatchingHunk } from "./patch.test.js";
import { testRunLogListsAndReadsSavedLogs, testRunLogSavesJsonFile } from "./runLog.test.js";
import {
  testExtractRetryRunOptionsReadsLogFields,
  testExtractRetryRunOptionsRequiresTaskAndWorkspace,
  testExtractRetryRunOptionsUsesFallbackModel
} from "./retryLog.test.js";
import { testParseCommandLineKeepsQuotedArgs, testParseCommandLineRejectsUnclosedQuote } from "./testCommand.test.js";
import {
  testIntakeValidationRequiresKnownRiskLevel,
  testIntakeValidationAcceptsSingleStringLists,
  testParseJsonObjectAcceptsFencedJson,
  testPlannerValidationAcceptsSingleVerificationString,
  testWorkerValidationRequiresContentOrPatchForUpdate
} from "./validation.test.js";
import { testWorkspaceAppliesCreateEdits, testWorkspaceRejectsEscapingPaths, testWorkspaceSearchTextFindsMatches } from "./workspace.test.js";

const tests: Array<[string, () => void | Promise<void>]> = [
  ["workspace rejects absolute and escaping paths", testWorkspaceRejectsEscapingPaths],
  ["workspace applies approved create edits inside root", testWorkspaceAppliesCreateEdits],
  ["workspace search text finds matches", testWorkspaceSearchTextFindsMatches],
  ["chat log path to id extracts JSON file name", testChatLogPathToIdExtractsJsonFileName],
  ["split input lines normalizes Windows newlines", testSplitInputLinesNormalizesWindowsNewlines],
  ["parseJsonObject accepts fenced JSON", testParseJsonObjectAcceptsFencedJson],
  ["worker validation requires content or patch for update", testWorkerValidationRequiresContentOrPatchForUpdate],
  ["intake validation requires known risk level", testIntakeValidationRequiresKnownRiskLevel],
  ["intake validation accepts single string lists", testIntakeValidationAcceptsSingleStringLists],
  ["planner validation accepts single verification string", testPlannerValidationAcceptsSingleVerificationString],
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
  ["orchestrator repairs malformed reviewer JSON", testOrchestratorRepairsMalformedReviewerJson],
  ["orchestrator stops when intake is not ready", testOrchestratorStopsWhenIntakeIsNotReady],
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

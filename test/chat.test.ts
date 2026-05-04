import assert from "node:assert/strict";
import {
  chatLogPathToId,
  createIdleStatus,
  createRunningStatus,
  formatLanguage,
  formatTaskStatus,
  isStrayApprovalToken,
  parseLanguage,
  splitInputLines
} from "../src/chat.js";

export function testChatLogPathToIdExtractsJsonFileName(): void {
  assert.equal(chatLogPathToId("C:\\tmp\\.pirafu\\logs\\pirafu-1.json"), "pirafu-1");
}

export function testSplitInputLinesNormalizesWindowsNewlines(): void {
  assert.deepEqual(splitInputLines(Buffer.from("task\r\ny\r\n/exit\r\n")), ["task", "y", "/exit", ""]);
}

export function testParseLanguageAcceptsJapaneseAndEnglishAliases(): void {
  assert.equal(parseLanguage("ja"), "ja");
  assert.equal(parseLanguage("日本語"), "ja");
  assert.equal(parseLanguage("en"), "en");
  assert.equal(parseLanguage("英語"), "en");
  assert.equal(parseLanguage("de"), undefined);
}

export function testFormatLanguageLabelsState(): void {
  assert.equal(formatLanguage("ja"), "ja (Japanese)");
  assert.equal(formatLanguage("en"), "en (English)");
}

export function testFormatTaskStatusShowsStateAndLog(): void {
  assert.equal(formatTaskStatus(createIdleStatus()), "status=idle No task has run yet.");
  assert.equal(formatTaskStatus({ state: "completed", task: "make file", logId: "pirafu-1", message: "Task completed." }), 'status=completed Task completed. task="make file" log=pirafu-1');
}

export function testCreateRunningStatusIncludesTask(): void {
  assert.deepEqual(createRunningStatus("make file"), {
    state: "running",
    task: "make file",
    message: "Task is running."
  });
}

export function testIsStrayApprovalTokenDetectsApprovalReplies(): void {
  assert.equal(isStrayApprovalToken("y"), true);
  assert.equal(isStrayApprovalToken("yes"), true);
  assert.equal(isStrayApprovalToken("n"), true);
  assert.equal(isStrayApprovalToken("q"), true);
  assert.equal(isStrayApprovalToken("make file"), false);
}

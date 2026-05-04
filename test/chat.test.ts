import assert from "node:assert/strict";
import { chatLogPathToId, formatLanguage, parseLanguage, splitInputLines } from "../src/chat.js";

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

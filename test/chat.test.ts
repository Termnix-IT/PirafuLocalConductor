import assert from "node:assert/strict";
import { chatLogPathToId, splitInputLines } from "../src/chat.js";

export function testChatLogPathToIdExtractsJsonFileName(): void {
  assert.equal(chatLogPathToId("C:\\tmp\\.pirafu\\logs\\pirafu-1.json"), "pirafu-1");
}

export function testSplitInputLinesNormalizesWindowsNewlines(): void {
  assert.deepEqual(splitInputLines(Buffer.from("task\r\ny\r\n/exit\r\n")), ["task", "y", "/exit", ""]);
}

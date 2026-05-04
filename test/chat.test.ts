import assert from "node:assert/strict";
import { chatLogPathToId } from "../src/chat.js";

export function testChatLogPathToIdExtractsJsonFileName(): void {
  assert.equal(chatLogPathToId("C:\\tmp\\.pirafu\\logs\\pirafu-1.json"), "pirafu-1");
}

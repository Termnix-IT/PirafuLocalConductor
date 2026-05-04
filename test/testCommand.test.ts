import assert from "node:assert/strict";
import { parseCommandLine } from "../src/testCommand.js";

export function testParseCommandLineKeepsQuotedArgs(): void {
  assert.deepEqual(parseCommandLine("npm run test -- --grep \"hello world\""), ["npm", "run", "test", "--", "--grep", "hello world"]);
}

export function testParseCommandLineRejectsUnclosedQuote(): void {
  assert.throws(() => parseCommandLine("npm test \"oops"), /Unclosed quote/);
}

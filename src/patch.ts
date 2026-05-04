export function applyUnifiedPatch(original: string, patch: string): string {
  const originalLines = splitLines(original);
  const patchLines = patch.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const output: string[] = [];
  let originalIndex = 0;
  let patchIndex = 0;
  let sawHunk = false;

  while (patchIndex < patchLines.length) {
    const line = patchLines[patchIndex] ?? "";
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.length === 0) {
      patchIndex += 1;
      continue;
    }

    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (!hunk) {
      throw new Error(`Invalid patch line: ${line}`);
    }
    sawHunk = true;

    const oldStart = Number.parseInt(hunk[1] ?? "1", 10) - 1;
    while (originalIndex < oldStart) {
      output.push(originalLines[originalIndex] ?? "");
      originalIndex += 1;
    }

    patchIndex += 1;
    while (patchIndex < patchLines.length) {
      const operation = patchLines[patchIndex] ?? "";
      if (operation.startsWith("@@ ")) {
        break;
      }
      if (operation === "\\ No newline at end of file" || operation.length === 0) {
        patchIndex += 1;
        continue;
      }

      const prefix = operation[0];
      const text = operation.slice(1);
      if (prefix === " ") {
        assertOriginalLine(originalLines, originalIndex, text);
        output.push(text);
        originalIndex += 1;
      } else if (prefix === "-") {
        assertOriginalLine(originalLines, originalIndex, text);
        originalIndex += 1;
      } else if (prefix === "+") {
        output.push(text);
      } else {
        throw new Error(`Invalid patch operation: ${operation}`);
      }
      patchIndex += 1;
    }
  }

  if (!sawHunk) {
    throw new Error("Patch did not contain a hunk.");
  }

  while (originalIndex < originalLines.length) {
    output.push(originalLines[originalIndex] ?? "");
    originalIndex += 1;
  }

  return `${output.join("\n")}${original.endsWith("\n") || patch.includes("\n+") ? "\n" : ""}`;
}

function assertOriginalLine(originalLines: string[], index: number, expected: string): void {
  const actual = originalLines[index];
  if (actual !== expected) {
    throw new Error(`Patch context mismatch at original line ${index + 1}: expected "${expected}", got "${actual ?? "<eof>"}"`);
  }
}

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
}

export function createUnifiedDiff(filePath: string, before: string, after: string): string {
  if (before === after) {
    return `--- a/${filePath}\n+++ b/${filePath}\n`;
  }

  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const operations = diffLines(beforeLines, afterLines);
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`, "@@ -1 +1 @@"];

  for (const operation of operations) {
    const prefix = operation.type === "same" ? " " : operation.type === "add" ? "+" : "-";
    lines.push(`${prefix}${operation.line}`);
  }

  return `${lines.join("\n")}\n`;
}

interface DiffOperation {
  type: "same" | "add" | "remove";
  line: string;
}

function diffLines(before: string[], after: string[]): DiffOperation[] {
  const table = Array.from({ length: before.length + 1 }, () => Array<number>(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      operations.push({ type: "same", line: before[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      operations.push({ type: "remove", line: before[i] });
      i += 1;
    } else {
      operations.push({ type: "add", line: after[j] });
      j += 1;
    }
  }

  while (i < before.length) {
    operations.push({ type: "remove", line: before[i] });
    i += 1;
  }
  while (j < after.length) {
    operations.push({ type: "add", line: after[j] });
    j += 1;
  }

  return operations;
}

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

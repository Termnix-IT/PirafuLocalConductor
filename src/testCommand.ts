import { spawn } from "node:child_process";
import type { TestCommandResult } from "./types.js";

export type TestCommandRunner = (commandLine: string, cwd: string, logger: Pick<Console, "log" | "error">) => Promise<TestCommandResult>;

export function parseCommandLine(commandLine: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "\"" | "'" | undefined;

  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index];
    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = undefined;
      continue;
    }
    if (/\s/.test(char ?? "") && !quote) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (quote) {
    throw new Error("Unclosed quote in test command.");
  }
  if (current.length > 0) {
    args.push(current);
  }
  if (args.length === 0) {
    throw new Error("Test command must not be empty.");
  }
  return args;
}

export const runTestCommand: TestCommandRunner = async (commandLine, cwd, logger) => {
  const [command, ...args] = parseCommandLine(commandLine);
  logger.log(`Test command: ${commandLine}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      const result: TestCommandResult = { command: commandLine, exitCode, signal, stdout, stderr };
      if (stdout.trim()) {
        logger.log(stdout.trim());
      }
      if (stderr.trim()) {
        logger.error(stderr.trim());
      }
      logger.log(`Test command exited with ${exitCode ?? `signal ${signal}`}.`);
      resolve(result);
    });
  });
};

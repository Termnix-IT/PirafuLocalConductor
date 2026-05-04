#!/usr/bin/env node
import { createInteractiveApproval } from "./approval.js";
import { runChat } from "./chat.js";
import { runDoctor } from "./doctor.js";
import { OllamaClient } from "./ollamaClient.js";
import { runOrchestrator } from "./orchestrator.js";
import { extractRetryRunOptions } from "./retryLog.js";
import { listRunLogs, readRunLog, saveRunLog, SessionLogger } from "./runLog.js";

interface CliOptions {
  command?: string;
  workspace?: string;
  task?: string;
  model: string;
  dryRun: boolean;
  reviewRetries: number;
  logDir: string;
  testCommand?: string;
  positional: string[];
  help: boolean;
}

const defaultModel = "gemma4:latest";

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  if (options.help || !options.command) {
    printHelp();
    return;
  }

  if (options.command === "doctor") {
    ensureNoExtraArgs(options);
    const result = await runDoctor(options.model);
    console.log(`node: ${result.node}`);
    console.log(`npm: ${result.npm}`);
    console.log(`ollama: ${result.ollama}`);
    console.log(`model ${result.model}: ${result.modelAvailable ? "available" : "missing"}`);
    if (!result.modelAvailable) {
      process.exitCode = 1;
    }
    return;
  }

  if (options.command === "run") {
    ensureNoExtraArgs(options);
    if (!options.workspace) {
      throw new Error("--workspace is required for run.");
    }
    if (!options.task) {
      throw new Error("--task is required for run.");
    }
    await executeRun(options.command, options, options.task, options.workspace, options.model);
    return;
  }

  if (options.command === "chat") {
    ensureNoExtraArgs(options);
    if (!options.workspace) {
      throw new Error("--workspace is required for chat.");
    }
    await runChat({
      workspace: options.workspace,
      model: options.model,
      dryRun: options.dryRun,
      reviewRetries: options.reviewRetries,
      logDir: options.logDir,
      testCommand: options.testCommand
    });
    return;
  }

  if (options.command === "logs") {
    const subcommand = options.positional[0];
    if (subcommand === "list") {
      const logs = await listRunLogs(options.logDir);
      if (logs.length === 0) {
        console.log(`No run logs found in ${options.logDir}`);
        return;
      }
      for (const log of logs) {
        console.log(`${log.id}\t${log.modifiedTime}\t${log.path}`);
      }
      return;
    }
    if (subcommand === "show") {
      const id = options.positional[1];
      if (!id) {
        throw new Error("logs show requires a log id or path.");
      }
      console.log(JSON.stringify(await readRunLog(options.logDir, id), null, 2));
      return;
    }
    throw new Error("logs requires a subcommand: list or show.");
  }

  if (options.command === "retry" || options.command === "resume") {
    const id = options.positional[0];
    if (!id) {
      throw new Error(`${options.command} requires a log id or path.`);
    }
    if (options.positional.length > 1) {
      throw new Error(`Unexpected argument(s): ${options.positional.slice(1).join(", ")}`);
    }
    const retryOptions = extractRetryRunOptions(await readRunLog(options.logDir, id), options.model);
    await executeRun(options.command, options, retryOptions.task, retryOptions.workspace, retryOptions.model);
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

async function executeRun(command: string, options: CliOptions, task: string, workspace: string, model: string): Promise<void> {
  const client = new OllamaClient({ model });
  const logger = new SessionLogger();
  let result: unknown;
  try {
    result = await runOrchestrator({
      workspacePath: workspace,
      task,
      model,
      client,
      approval: createInteractiveApproval(),
      dryRun: options.dryRun,
      maxReviewRetries: options.reviewRetries,
      testCommand: options.testCommand,
      logger
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const logPath = await saveRunLog({
      logDir: options.logDir,
      command,
      task,
      workspace,
      model,
      events: logger.snapshot(),
      error: message
    });
    console.error(`Run log saved: ${logPath}`);
    throw error;
  }

  const logPath = await saveRunLog({
    logDir: options.logDir,
    command,
    task,
    workspace,
    model,
    events: logger.snapshot(),
    result
  });
  console.log(`Run log saved: ${logPath}`);
}

function ensureNoExtraArgs(options: CliOptions): void {
  if (options.positional.length > 0) {
    throw new Error(`Unexpected argument(s): ${options.positional.join(", ")}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    model: defaultModel,
    dryRun: false,
    reviewRetries: 1,
    logDir: ".pirafu/logs",
    positional: [],
    help: false
  };
  const args = [...argv];
  if (args[0] === "--help" || args[0] === "-h") {
    return { ...options, help: true };
  }
  options.command = args.shift();

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--workspace") {
      options.workspace = requireValue(arg, args.shift());
    } else if (arg === "--task") {
      options.task = requireValue(arg, args.shift());
    } else if (arg === "--model") {
      options.model = requireValue(arg, args.shift());
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--review-retries") {
      options.reviewRetries = parseNonNegativeInteger(arg, requireValue(arg, args.shift()));
    } else if (arg === "--log-dir") {
      options.logDir = requireValue(arg, args.shift());
    } else if (arg === "--test-command") {
      options.testCommand = requireValue(arg, args.shift());
    } else {
      options.positional.push(arg);
    }
  }

  return options;
}

function parseNonNegativeInteger(flag: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`${flag} requires a non-negative integer.`);
  }
  return parsed;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Pirafu Local Conductor

Usage:
  pirafu doctor [--model gemma4:latest]
  pirafu run --workspace <path> --task <request> [--model gemma4:latest] [--dry-run] [--review-retries 1] [--test-command "npm test"] [--log-dir .pirafu/logs]
  pirafu chat --workspace <path> [--model gemma4:latest] [--dry-run] [--review-retries 1] [--test-command "npm test"] [--log-dir .pirafu/logs]
  pirafu logs list [--log-dir .pirafu/logs]
  pirafu logs show <id> [--log-dir .pirafu/logs]
  pirafu retry <id> [--dry-run] [--review-retries 1] [--test-command "npm test"] [--log-dir .pirafu/logs]
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

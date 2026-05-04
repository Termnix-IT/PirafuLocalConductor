#!/usr/bin/env node
import { createInteractiveApproval } from "./approval.js";
import { runDoctor } from "./doctor.js";
import { OllamaClient } from "./ollamaClient.js";
import { runOrchestrator } from "./orchestrator.js";
import { saveRunLog, SessionLogger } from "./runLog.js";

interface CliOptions {
  command?: string;
  workspace?: string;
  task?: string;
  model: string;
  dryRun: boolean;
  reviewRetries: number;
  logDir: string;
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
    if (!options.workspace) {
      throw new Error("--workspace is required for run.");
    }
    if (!options.task) {
      throw new Error("--task is required for run.");
    }

    const client = new OllamaClient({ model: options.model });
    const logger = new SessionLogger();
    let result: unknown;
    try {
      result = await runOrchestrator({
        workspacePath: options.workspace,
        task: options.task,
        model: options.model,
        client,
        approval: createInteractiveApproval(),
        dryRun: options.dryRun,
        maxReviewRetries: options.reviewRetries,
        logger
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const logPath = await saveRunLog({
        logDir: options.logDir,
        command: options.command,
        task: options.task,
        workspace: options.workspace,
        model: options.model,
        events: logger.snapshot(),
        error: message
      });
      console.error(`Run log saved: ${logPath}`);
      throw error;
    }

    const logPath = await saveRunLog({
      logDir: options.logDir,
      command: options.command,
      task: options.task,
      workspace: options.workspace,
      model: options.model,
      events: logger.snapshot(),
      result
    });
    console.log(`Run log saved: ${logPath}`);
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    model: defaultModel,
    dryRun: false,
    reviewRetries: 1,
    logDir: ".pirafu/logs",
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
    } else {
      throw new Error(`Unknown option: ${arg}`);
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
  pirafu run --workspace <path> --task <request> [--model gemma4:latest] [--dry-run] [--review-retries 1] [--log-dir .pirafu/logs]
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

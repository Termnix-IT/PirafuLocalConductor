#!/usr/bin/env node
import { createInteractiveApproval } from "./approval.js";
import { runDoctor } from "./doctor.js";
import { OllamaClient } from "./ollamaClient.js";
import { runOrchestrator } from "./orchestrator.js";

interface CliOptions {
  command?: string;
  workspace?: string;
  task?: string;
  model: string;
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
    await runOrchestrator({
      workspacePath: options.workspace,
      task: options.task,
      model: options.model,
      client,
      approval: createInteractiveApproval()
    });
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { model: defaultModel, help: false };
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
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
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
  pirafu run --workspace <path> --task <request> [--model gemma4:latest]
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

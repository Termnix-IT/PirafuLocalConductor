import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createQuestionApproval } from "./approval.js";
import { runDoctor } from "./doctor.js";
import { OllamaClient } from "./ollamaClient.js";
import { runOrchestrator } from "./orchestrator.js";
import { extractRetryRunOptions } from "./retryLog.js";
import { listRunLogs, readRunLog, saveRunLog, SessionLogger } from "./runLog.js";
import type { ResponseLanguage } from "./types.js";

export interface ChatOptions {
  workspace: string;
  model: string;
  dryRun: boolean;
  reviewRetries: number;
  logDir: string;
  testCommand?: string;
}

export async function runChat(options: ChatOptions): Promise<void> {
  const prompt = await createPrompt();
  let dryRun = options.dryRun;
  let language: ResponseLanguage = "ja";
  let lastLogId: string | undefined;
  let taskStatus: ChatTaskStatus = createIdleStatus();

  output.write(`Pirafu Local Conductor\nWorkspace: ${options.workspace}\nModel: ${options.model}\nLanguage: ${formatLanguage(language)}\nType /help for commands.\n\n`);

  try {
    while (true) {
      const line = (await prompt.question("pirafu> ")).trim();
      if (!line) {
        if (prompt.done) {
          break;
        }
        continue;
      }
      if (line === "/exit" || line === "/quit") {
        break;
      }
      if (line.startsWith("/")) {
        const result = await handleChatCommand(line, options, dryRun, language, lastLogId, taskStatus, prompt);
        dryRun = result.dryRun;
        language = result.language;
        lastLogId = result.lastLogId ?? lastLogId;
        taskStatus = result.taskStatus ?? taskStatus;
        if (result.exit) {
          break;
        }
        continue;
      }

      taskStatus = createRunningStatus(line);
      printTaskStatus(taskStatus);
      const result = await executeChatTask(line, options, dryRun, language, prompt);
      taskStatus = result.status;
      lastLogId = result.logId ?? lastLogId;
      printTaskStatus(taskStatus);
    }
  } finally {
    prompt.close();
  }
}

interface Prompt {
  done: boolean;
  question(query: string): Promise<string>;
  close(): void;
}

interface ChatCommandResult {
  dryRun: boolean;
  language: ResponseLanguage;
  lastLogId?: string;
  taskStatus?: ChatTaskStatus;
  exit?: boolean;
}

export type ChatTaskState = "idle" | "running" | "completed" | "failed";

export interface ChatTaskStatus {
  state: ChatTaskState;
  task?: string;
  logId?: string;
  message: string;
}

async function handleChatCommand(
  line: string,
  options: ChatOptions,
  dryRun: boolean,
  language: ResponseLanguage,
  lastLogId: string | undefined,
  taskStatus: ChatTaskStatus,
  prompt: Prompt
): Promise<ChatCommandResult> {
  const [command, ...args] = line.split(/\s+/);
  if (command === "/help") {
    output.write(
      [
        "Commands:",
        "  /help",
        "  /doctor",
        "  /logs",
        "  /show <id|last>",
        "  /retry <id|last>",
        "  /status",
        "  /language ja|en",
        "  /dry-run on|off",
        "  /exit",
        "Plain text is treated as a coding task.",
        ""
      ].join("\n")
    );
    return { dryRun, language };
  }
  if (command === "/doctor") {
    const result = await runDoctor(options.model);
    output.write(`node: ${result.node}\nnpm: ${result.npm}\nollama: ${result.ollama}\nmodel ${result.model}: ${result.modelAvailable ? "available" : "missing"}\n`);
    return { dryRun, language };
  }
  if (command === "/logs") {
    const logs = await listRunLogs(options.logDir);
    if (logs.length === 0) {
      output.write(`No run logs found in ${options.logDir}\n`);
    } else {
      for (const log of logs.slice(0, 20)) {
        output.write(`${log.id}\t${log.modifiedTime}\t${log.path}\n`);
      }
    }
    return { dryRun, language };
  }
  if (command === "/show") {
    const id = resolveChatLogId(args[0], lastLogId);
    output.write(`${JSON.stringify(await readRunLog(options.logDir, id), null, 2)}\n`);
    return { dryRun, language };
  }
  if (command === "/retry") {
    const id = resolveChatLogId(args[0], lastLogId);
    const retryOptions = extractRetryRunOptions(await readRunLog(options.logDir, id), options.model);
    const running = createRunningStatus(retryOptions.task);
    printTaskStatus(running);
    const result = await executeChatTask(retryOptions.task, { ...options, workspace: retryOptions.workspace, model: retryOptions.model }, dryRun, language, prompt);
    printTaskStatus(result.status);
    return { dryRun, language, lastLogId: result.logId, taskStatus: result.status };
  }
  if (command === "/status") {
    printTaskStatus(taskStatus);
    return { dryRun, language };
  }
  if (command === "/language") {
    const nextLanguage = parseLanguage(args[0]);
    if (!nextLanguage) {
      output.write(`language is ${formatLanguage(language)}. Use /language ja or /language en.\n`);
      return { dryRun, language };
    }
    output.write(`language ${formatLanguage(nextLanguage)}\n`);
    return { dryRun, language: nextLanguage };
  }
  if (command === "/dry-run") {
    const value = args[0];
    if (value !== "on" && value !== "off") {
      output.write(`dry-run is ${dryRun ? "on" : "off"}. Use /dry-run on or /dry-run off.\n`);
      return { dryRun, language };
    }
    const next = value === "on";
    output.write(`dry-run ${next ? "on" : "off"}\n`);
    return { dryRun: next, language };
  }
  if (command === "/exit" || command === "/quit") {
    return { dryRun, language, exit: true };
  }

  output.write(`Unknown command: ${command}. Type /help.\n`);
  return { dryRun, language };
}

async function executeChatTask(
  task: string,
  options: ChatOptions,
  dryRun: boolean,
  language: ResponseLanguage,
  prompt: Prompt
): Promise<{ logId?: string; status: ChatTaskStatus }> {
  const client = new OllamaClient({ model: options.model });
  const logger = new SessionLogger();
  let result: unknown;
  try {
    result = await runOrchestrator({
      workspacePath: options.workspace,
      task,
      model: options.model,
      client,
      approval: createQuestionApproval((query) => prompt.question(query)),
      dryRun,
      maxReviewRetries: options.reviewRetries,
      testCommand: options.testCommand,
      language,
      logger
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const logPath = await saveRunLog({
      logDir: options.logDir,
      command: "chat",
      task,
      workspace: options.workspace,
      model: options.model,
      events: logger.snapshot(),
      error: message
    });
    output.write(`Run log saved: ${logPath}\n`);
    return {
      logId: chatLogPathToId(logPath),
      status: {
        state: "failed",
        task,
        logId: chatLogPathToId(logPath),
        message
      }
    };
  }

  const logPath = await saveRunLog({
    logDir: options.logDir,
    command: "chat",
    task,
    workspace: options.workspace,
    model: options.model,
    events: logger.snapshot(),
    result
  });
  output.write(`Run log saved: ${logPath}\n`);
  return {
    logId: chatLogPathToId(logPath),
    status: {
      state: "completed",
      task,
      logId: chatLogPathToId(logPath),
      message: "Task completed."
    }
  };
}

export function createIdleStatus(): ChatTaskStatus {
  return { state: "idle", message: "No task has run yet." };
}

export function createRunningStatus(task: string): ChatTaskStatus {
  return { state: "running", task, message: "Task is running." };
}

export function formatTaskStatus(status: ChatTaskStatus): string {
  const parts = [`status=${status.state}`, status.message];
  if (status.task) {
    parts.push(`task="${status.task}"`);
  }
  if (status.logId) {
    parts.push(`log=${status.logId}`);
  }
  return parts.join(" ");
}

function printTaskStatus(status: ChatTaskStatus): void {
  output.write(`${formatTaskStatus(status)}\n`);
}

function resolveChatLogId(value: string | undefined, lastLogId: string | undefined): string {
  if (value === "last") {
    if (!lastLogId) {
      throw new Error("No last log is available yet.");
    }
    return lastLogId;
  }
  if (!value) {
    throw new Error("A log id is required.");
  }
  return value;
}

export function chatLogPathToId(logPath: string): string {
  return logPath.replace(/\\/g, "/").split("/").pop()?.replace(/\.json$/i, "") ?? logPath;
}

async function createPrompt(): Promise<Prompt> {
  if (input.isTTY) {
    const rl = readline.createInterface({ input, output });
    return {
      done: false,
      question: (query) => rl.question(query),
      close: () => rl.close()
    };
  }

  const lines = await readAllInputLines();
  return {
    get done() {
      return lines.length === 0;
    },
    async question(query: string) {
      output.write(query);
      return lines.shift() ?? "";
    },
    close() {
      // Buffered non-TTY input does not need explicit closing.
    }
  };
}

async function readAllInputLines(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return splitInputLines(Buffer.concat(chunks));
}

export function splitInputLines(buffer: Buffer): string[] {
  return buffer.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function parseLanguage(value: string | undefined): ResponseLanguage | undefined {
  if (value === "ja" || value === "jp" || value === "japanese" || value === "日本語") {
    return "ja";
  }
  if (value === "en" || value === "english" || value === "英語") {
    return "en";
  }
  return undefined;
}

export function formatLanguage(language: ResponseLanguage): string {
  return language === "ja" ? "ja (Japanese)" : "en (English)";
}

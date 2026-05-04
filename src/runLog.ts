import { promises as fs } from "node:fs";
import path from "node:path";

interface LogEvent {
  level: "log" | "error";
  message: string;
  timestamp: string;
}

export class SessionLogger implements Pick<Console, "log" | "error"> {
  private readonly events: LogEvent[] = [];

  log(message?: unknown, ...optionalParams: unknown[]): void {
    const text = formatLogLine(message, optionalParams);
    this.events.push({ level: "log", message: text, timestamp: new Date().toISOString() });
    console.log(text);
  }

  error(message?: unknown, ...optionalParams: unknown[]): void {
    const text = formatLogLine(message, optionalParams);
    this.events.push({ level: "error", message: text, timestamp: new Date().toISOString() });
    console.error(text);
  }

  snapshot(): LogEvent[] {
    return [...this.events];
  }
}

export async function saveRunLog(options: {
  logDir: string;
  command: string;
  task?: string;
  workspace?: string;
  model: string;
  events: LogEvent[];
  result?: unknown;
  error?: string;
}): Promise<string> {
  await fs.mkdir(options.logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(options.logDir, `pirafu-${timestamp}.json`);
  await fs.writeFile(
    logPath,
    `${JSON.stringify(
      {
        command: options.command,
        task: options.task,
        workspace: options.workspace,
        model: options.model,
        events: options.events,
        result: options.result,
        error: options.error
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return logPath;
}

function formatLogLine(message: unknown, optionalParams: unknown[]): string {
  return [message, ...optionalParams].map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" ");
}

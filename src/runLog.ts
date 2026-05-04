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

export interface RunLogEntry {
  id: string;
  path: string;
  modifiedTime: string;
}

export async function listRunLogs(logDir: string): Promise<RunLogEntry[]> {
  const entries = await fs.readdir(logDir, { withFileTypes: true }).catch(() => []);
  const logs = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const logPath = path.join(logDir, entry.name);
        const stat = await fs.stat(logPath);
        return {
          id: entry.name.replace(/\.json$/i, ""),
          path: logPath,
          modifiedTime: stat.mtime.toISOString()
        };
      })
  );
  return logs.sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime));
}

export async function readRunLog(logDir: string, idOrPath: string): Promise<unknown> {
  const logPath = await resolveRunLogPath(logDir, idOrPath);
  return JSON.parse(await fs.readFile(logPath, "utf8")) as unknown;
}

async function resolveRunLogPath(logDir: string, idOrPath: string): Promise<string> {
  if (path.isAbsolute(idOrPath)) {
    return idOrPath;
  }

  const logs = await listRunLogs(logDir);
  const exactName = idOrPath.endsWith(".json") ? idOrPath.slice(0, -5) : idOrPath;
  const exact = logs.find((log) => log.id === exactName);
  if (exact) {
    return exact.path;
  }

  const matches = logs.filter((log) => log.id.startsWith(exactName));
  if (matches.length === 1) {
    return matches[0].path;
  }
  if (matches.length > 1) {
    throw new Error(`Multiple run logs match "${idOrPath}". Use a longer id.`);
  }
  throw new Error(`Run log not found: ${idOrPath}`);
}

function formatLogLine(message: unknown, optionalParams: unknown[]): string {
  return [message, ...optionalParams].map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" ");
}

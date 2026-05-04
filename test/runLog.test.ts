import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { listRunLogs, readRunLog, saveRunLog } from "../src/runLog.js";

export async function testRunLogSavesJsonFile(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-log-"));
  try {
    const logPath = await saveRunLog({
      logDir: root,
      command: "run",
      task: "test task",
      workspace: root,
      model: "fake",
      events: [{ level: "log", message: "hello", timestamp: new Date().toISOString() }],
      result: { applied: ["index.ts"] }
    });

    const data = JSON.parse(await readFile(logPath, "utf8")) as {
      command: string;
      events: Array<{ message: string }>;
      result: { applied: string[] };
    };
    assert.equal(data.command, "run");
    assert.equal(data.events[0]?.message, "hello");
    assert.deepEqual(data.result.applied, ["index.ts"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testRunLogListsAndReadsSavedLogs(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-log-"));
  try {
    const logPath = await saveRunLog({
      logDir: root,
      command: "run",
      task: "test task",
      workspace: root,
      model: "fake",
      events: [],
      result: { dryRun: true }
    });

    const logs = await listRunLogs(root);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.path, logPath);

    const data = (await readRunLog(root, logs[0]?.id ?? "")) as { result: { dryRun: boolean } };
    assert.equal(data.result.dryRun, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

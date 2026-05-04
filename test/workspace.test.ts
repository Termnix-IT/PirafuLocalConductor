import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { Workspace } from "../src/workspace.js";

export async function testWorkspaceRejectsEscapingPaths(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-workspace-"));
  try {
    const workspace = await Workspace.open(root);
    assert.throws(() => workspace.resolveInside("../outside.txt"), /must not escape/);
    assert.throws(() => workspace.resolveInside(path.join(root, "file.txt")), /must be relative/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function testWorkspaceAppliesCreateEdits(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-workspace-"));
  try {
    const workspace = await Workspace.open(root);
    await workspace.applyEdit({
      path: "src/example.ts",
      action: "create",
      reason: "test",
      content: "export const value = 1;\n"
    });

    const content = await readFile(path.join(root, "src", "example.ts"), "utf8");
    assert.equal(content, "export const value = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

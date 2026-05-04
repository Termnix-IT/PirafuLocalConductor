import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
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

export async function testWorkspaceSearchTextFindsMatches(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pirafu-workspace-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "message.ts"), "export const message = 'hello gemma4';\n", "utf8");
    const workspace = await Workspace.open(root);

    const results = await workspace.searchText(["gemma4"]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, "src/message.ts");
    assert.equal(results[0]?.line, 1);
    assert.equal(results[0]?.query, "gemma4");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

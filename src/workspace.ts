import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileSnapshot, ProposedEdit, SearchResult } from "./types.js";

const ignoredDirectories = new Set([".git", "node_modules", "dist", ".cache", ".next", "coverage"]);
const maxSearchFileBytes = 1024 * 1024;

export class Workspace {
  readonly root: string;

  private constructor(root: string) {
    this.root = root;
  }

  static async open(workspacePath: string): Promise<Workspace> {
    const root = path.resolve(workspacePath);
    const stat = await fs.stat(root).catch(() => undefined);
    if (!stat?.isDirectory()) {
      throw new Error(`Workspace does not exist or is not a directory: ${workspacePath}`);
    }
    return new Workspace(root);
  }

  resolveInside(relativePath: string): string {
    if (!relativePath || path.isAbsolute(relativePath)) {
      throw new Error(`Path must be relative to workspace: ${relativePath}`);
    }

    const normalized = relativePath.replaceAll("\\", "/");
    if (normalized.split("/").some((part) => part === "..")) {
      throw new Error(`Path must not escape workspace: ${relativePath}`);
    }

    const absolutePath = path.resolve(this.root, normalized);
    const relative = path.relative(this.root, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Path escapes workspace: ${relativePath}`);
    }
    return absolutePath;
  }

  async listFiles(limit = 200): Promise<string[]> {
    const results: string[] = [];
    await this.walk(this.root, "", results, limit);
    return results;
  }

  async readSnapshot(relativePath: string): Promise<FileSnapshot> {
    const absolutePath = this.resolveInside(relativePath);
    const content = await fs.readFile(absolutePath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    });

    return {
      path: relativePath.replaceAll("\\", "/"),
      exists: content !== undefined,
      content: content ?? ""
    };
  }

  async readSnapshots(relativePaths: string[]): Promise<FileSnapshot[]> {
    const unique = [...new Set(relativePaths.filter(Boolean))];
    return Promise.all(unique.map((file) => this.readSnapshot(file)));
  }

  async searchText(queries: string[], limit = 30): Promise<SearchResult[]> {
    const normalizedQueries = normalizeQueries(queries);
    if (normalizedQueries.length === 0) {
      return [];
    }

    const files = await this.listFiles(500);
    const results: SearchResult[] = [];
    for (const file of files) {
      if (results.length >= limit) {
        break;
      }

      const absolutePath = this.resolveInside(file);
      const stat = await fs.stat(absolutePath).catch(() => undefined);
      if (!stat?.isFile() || stat.size > maxSearchFileBytes) {
        continue;
      }

      const content = await fs.readFile(absolutePath, "utf8").catch(() => undefined);
      if (content === undefined || content.includes("\u0000")) {
        continue;
      }

      const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        if (results.length >= limit) {
          break;
        }
        const line = lines[index];
        const lowerLine = line.toLowerCase();
        const query = normalizedQueries.find((candidate) => lowerLine.includes(candidate.toLowerCase()));
        if (query) {
          results.push({
            path: file,
            line: index + 1,
            preview: line.trim().slice(0, 240),
            query
          });
        }
      }
    }

    return results;
  }

  async applyEdit(edit: ProposedEdit): Promise<void> {
    if (edit.action === "delete") {
      throw new Error("Delete edits are not supported in the initial version.");
    }
    if (edit.content === undefined) {
      throw new Error(`Edit content is required for ${edit.path}.`);
    }

    const absolutePath = this.resolveInside(edit.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, edit.content, "utf8");
  }

  private async walk(directory: string, prefix: string, results: string[], limit: number): Promise<void> {
    if (results.length >= limit) {
      return;
    }

    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (results.length >= limit) {
        return;
      }
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        continue;
      }

      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await this.walk(absolute, relative, results, limit);
        }
      } else if (entry.isFile()) {
        results.push(relative);
      }
    }
  }
}

function normalizeQueries(queries: string[]): string[] {
  return [
    ...new Set(
      queries
        .map((query) => query.trim())
        .filter((query) => query.length >= 2)
        .filter((query) => !/^\W+$/.test(query))
    )
  ].slice(0, 20);
}

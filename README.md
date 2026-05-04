# Pirafu Local Conductor

TypeScript CLI for orchestrating a local Ollama `gemma4:latest` coding supporter.

## Commands

```powershell
npm install
npm run build
node dist/src/cli.js doctor
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change"
```

The CLI uses a safe `Planner -> Worker -> Reviewer` flow. The Worker proposes full-file edits, the Reviewer checks the combined diff, and files are written only after one batch approval.

Before planning, Pirafu scans workspace text for task keywords and quoted strings. Those search hits are passed to Planner so it can choose target files from both file names and actual content matches.

## Useful run options

```powershell
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --dry-run
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --review-retries 2
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --log-dir .pirafu/logs
```

- `--dry-run` shows the reviewed diff and writes nothing.
- `--review-retries` asks Worker for a revised proposal when Reviewer rejects a diff.
- `--log-dir` controls where JSON run logs are saved. The default is `.pirafu/logs`.

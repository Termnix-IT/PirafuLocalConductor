# Pirafu Local Conductor

TypeScript CLI for orchestrating a local Ollama `gemma4:latest` coding supporter.

## Commands

```powershell
npm install
npm run build
node dist/src/cli.js doctor
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change"
node dist/src/cli.js chat --workspace C:\path\to\project
```

The CLI uses a safe `Intake -> Planner -> Worker -> Reviewer` flow. Intake acts as the front desk: it normalizes the request, records acceptance criteria and constraints, and stops before planning when the request is too ambiguous to edit safely. The Worker proposes edits, the Reviewer checks the combined diff, and files are written only after one batch approval.

Before planning, Pirafu scans workspace text for task keywords and quoted strings. Those search hits are passed to Planner so it can choose target files from both file names and actual content matches.

For updates, Worker can return either complete replacement content or a unified diff `patch`. Patches are validated against the current file content before Pirafu prepares the final reviewed diff.

## Useful run options

```powershell
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --dry-run
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --review-retries 2
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --test-command "npm test"
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change" --log-dir .pirafu/logs
node dist/src/cli.js logs list
node dist/src/cli.js logs show pirafu-2026-05-04T00-00-00-000Z
node dist/src/cli.js retry pirafu-2026-05-04T00-00-00-000Z --dry-run
```

- `--dry-run` shows the reviewed diff and writes nothing.
- `--review-retries` asks Worker for a revised proposal when Reviewer rejects a diff.
- `--test-command` runs an explicit validation command in the target workspace after approved changes are applied. In dry-run mode it runs after the reviewed diff is produced without applying files.
- `--log-dir` controls where JSON run logs are saved. The default is `.pirafu/logs`.
- `logs list` and `logs show` inspect saved JSON run logs.
- `retry` and `resume` rerun a saved log's task, workspace, and model. Current flags such as `--dry-run`, `--review-retries`, and `--test-command` still apply.

## Chat mode

```powershell
node dist/src/cli.js chat --workspace C:\path\to\project
```

Inside chat mode, plain text is treated as a coding task. Slash commands are handled locally:

- `/help`
- `/doctor`
- `/logs`
- `/show <id|last>`
- `/retry <id|last>`
- `/dry-run on`
- `/dry-run off`
- `/exit`

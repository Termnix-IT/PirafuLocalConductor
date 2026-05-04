# AGENTS.md

## Language
- Respond to the user in Japanese by default.
- Keep code, commands, file paths, API names, JSON keys, and other technical identifiers in their original English form.
- If the user explicitly asks for English, switch to English for that response.
- When technical terms first appear, add a short Japanese explanation only if it helps clarity.

## File Naming
- Use English names for files that are meant to be executed or imported as program code, such as source files, scripts, modules, config files, and build-related files.
- Prefer Japanese file names for reference-oriented documents, notes, study materials, manuals, reports, and other files primarily meant to be read by the user.
- Keep technical identifiers inside file contents in their original English form even when the document file name is Japanese.

## Project Overview
- This repository implements `Pirafu Local Conductor`, a TypeScript CLI that orchestrates local Ollama `gemma4:latest` as a coding supporter.
- The main flow is `Intake -> Planner -> Worker -> Reviewer -> Approval -> Apply -> TestCommand -> Log`.
- `pirafu chat` is the interactive front door for file-editing tasks. Plain text entered in chat is treated as a coding task.
- Keep the orchestrator safe by default: no file writes before approval, no workspace escape, and no direct shell access for LLM agents.

## Development Commands
- Install dependencies: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Doctor check: `npm run doctor`
- CLI help after build: `node dist/src/cli.js --help`
- Chat mode after build: `node dist/src/cli.js chat --workspace <path>`

## Implementation Rules
- Keep source files, tests, scripts, and config file names in English.
- Use Node standard APIs first. Avoid adding dependencies unless they remove meaningful complexity.
- LLM-facing structured outputs must be validated in `src/validation.ts`.
- If local LLM output is likely to vary, normalize safe schema variations in validation rather than weakening downstream assumptions.
- Workspace access must go through `Workspace` helpers in `src/workspace.ts`.
- Do not let agents write outside the configured workspace.
- Do not add shell execution paths that the LLM can control directly. Explicit user-provided commands such as `--test-command` are the boundary.

## Testing Rules
- Add or update focused tests for each behavior change.
- Run `npm test` before reporting work complete.
- For chat-related behavior, include non-TTY/piped input coverage when practical, because PowerShell pipe behavior differs from interactive input.
- Manual scratch work and run logs should live under `.pirafu/`, which is ignored by Git.

## Git Hygiene
- Do not commit `dist/`, `node_modules/`, `.pirafu/`, `.env*`, or personal usage notes.
- Commit source, tests, README, and project-level instructions when changed.

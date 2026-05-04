# Pirafu Local Conductor

TypeScript CLI for orchestrating a local Ollama `gemma4:latest` coding supporter.

## Commands

```powershell
npm install
npm run build
node dist/src/cli.js doctor
node dist/src/cli.js run --workspace C:\path\to\project --task "Make the requested change"
```

The first version uses a safe `Planner -> Worker -> Reviewer` flow. The Worker proposes full-file edits, the CLI shows diffs, and files are written only after interactive approval.

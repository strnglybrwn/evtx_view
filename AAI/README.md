# AAI — local agent orchestration prototype

This repository is a small prototype that demonstrates an orchestrator pattern: a lightweight frontend sends user input (text and/or attachments) to a server that selects and runs small "agents" to produce a combined answer.

Quick start (local development)

Requirements: Node.js 16+ recommended.

```bash
# from repo root
npm install
# start server (serves web/ as static files)
node AAI/server/index.js
# open http://localhost:3000 in your browser
```

- Project structure
- `web/` — static frontend: `index.html`, `main.js`. Handles paste/drop, preview thumbnails, and the preview → run flow.
- `server/` — Express server and API implementation (`index.js`). Implements preview mode, SSE streaming, attachments handling, and an in-memory secret store.
- `agents/` — agent modules. Each exports `supports(input): number` and `run(input): Promise<{output, metadata}>`.
- `lib/secretStore.js` — small secret storage used by agent modules.
- Conversation memory: server issues a lightweight session cookie and keeps the last 10 Q/A pairs in-memory (per session). Language-model style agents receive prior Q/A as context automatically.

API (summary)

- This prototype provides a transient in-memory secret store: `lib/secretStore.js`.
- When you provide an `apiKey` through the UI retry flow, the server stores it in memory (under `external_api_key`) and agents can read its presence. Secrets are never echoed back in responses. The store is cleared on server restart.
 - The secret store now persists secrets to `.env.local` in the repository root to survive restarts. WARNING: this writes secrets in plaintext to disk and is intended only for local development/prototyping. For production use a secure vault or environment variable management.

Contract
- POST /api/solve { input: string } -> { result, agents: [{name, output, durationMs, metadata}] }

Live updates
- GET /api/solve-stream?input=<text> — Server-Sent Events (SSE) stream that emits `agent-start`, `agent-done`, `agent-error`, and `final` events. The web UI's "Run with live updates" button uses this.

Quick manual stream test (curl):
```bash
curl -N "http://localhost:3000/api/solve-stream?input=apple"
```

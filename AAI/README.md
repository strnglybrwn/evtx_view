# AAI — minimal prototype

This repository is a small scaffold for the AAI demo described in `AAI/instructions.txt`.

Run locally (Node.js required):

```bash
npm install
npm run dev
# open http://localhost:3000
```

Structure
- `web/` — static frontend (index.html, main.js)
- `server/` — Express server and API (`/api/solve`)
- `agents/` — small agent modules. Example: `agents/exampleAgent.js`

Agents
- `agents/duckduckgoAgent.js` — queries DuckDuckGo Instant Answer API (no key) and returns a short summary when available.
- `agents/exampleAgent.js` — simple echo agent used for testing.

Secrets and API keys
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

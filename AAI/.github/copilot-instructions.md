<!-- Purpose: concise, actionable guidance for AI coding agents working in this repository -->
# Copilot instructions — AAI

## Purpose
Help AI agents be immediately productive in this agent orchestration prototype for web-based multi-agent queries.

## Quick start
```bash
npm install
npm run dev  # starts Express server at http://localhost:3000
```

## Architecture overview

**Data flow:** user input (text + optional attachments) → agent selection (via `supports()` scoring) → run top agent → return result + history

**Key components:**
- **web/** — vanilla JS UI: paste/drop images, input field, preview agent selection, SSE stream for live updates
- **server/index.js** — Express orchestrator with session management, two API endpoints:
  - `POST /api/solve` — synchronous: returns agent scores, selection rationale, result
  - `GET /api/solve-stream` — SSE stream of agent events (`agent-score`, `agent-start`, `agent-done`, `final`)
- **agents/** — modular agent implementations (exampleAgent, duckduckgoAgent, openaiAgent)
- **lib/secretStore.js** — transient key-value store persisting to `.env.local` (plaintext, dev-only)

## Agent contract & selection

**Agent module interface** (`agents/exampleAgent.js`):
```javascript
// Exports all three; run is async, supports is sync.
module.exports = { run, supports, requirements };

async function run(input) {
  // ... call external API or local logic ...
  return { output: "result string", metadata: { key: "value" } };
}

function supports(input) {
  // Return 0.0–1.0. Server selects agent with score >= 0.6; ties broken by highest score.
  // Heuristic example: if (input.includes("weather")) return 0.85;
  return 0.5;
}

const requirements = ['internet-access']; // e.g., 'openai_api_key', 'image-analysis'
```

**Agent selection logic** (in `server/index.js`):
- All agents scored simultaneously; highest-scoring agent with score ≥ 0.6 is selected
- If no agent exceeds threshold, client is told which `needs` are inferred from the query
- History agents (`openaiAgent`, `exampleAgent`) automatically receive conversation history prepended to input

## Key patterns & conventions

1. **Agents are stateless & composable.** Return plain objects `{ output, metadata }`. No global state or side effects.
2. **Attachments handling.** Images are base64-encoded client-side, sent in `POST /api/solve` as array. Server validates size (~3MB max).
3. **Session & history.** Each user gets a session cookie (`aai_sid`). Last 10 Q/A pairs cached in-memory per session.
4. **Secrets management.** Use `lib/secretStore.js` to check for keys. OpenAI agent searches multiple sources (env, `.env`, `.env.local`, secretStore).
5. **Error handling.** Agent errors caught in orchestrator; returned in response under `agents[].error`. No silent failures.
6. **Timing & metadata.** Every agent result includes `durationMs` and `metadata`. Stream events include these for UI visibility.

## API contracts

**POST /api/solve**
```
Request: { input: "string", attachments?: [{name, type, data: base64}], preview?: boolean }
Response: { result: "...", agents: [{name, output, durationMs, metadata?, error?}], scored, rationale }
- preview=true returns scores & selection without running agents
```

**GET /api/solve-stream?input=...**
```
SSE stream emitting: agent-score, agent-start, agent-done, agent-error, selection, final, done
Each event is JSON in data field. UI opens stream on "Run with live updates" button click.
```

**POST /api/provide**
```
Request: { input: "string", attachments?: [{name, type, data: base64}], apiKey?: "string", needs?: ["capability"] }
Response: { ran: boolean, result?: "...", agents?: [...], message?: "..." }
- Called when user provides missing resources (e.g., API key) after initial selection failed
- If needs includes "internet-access" + apiKey provided, re-runs agent selection with key stored in secretStore
- If needs includes "image-analysis" + attachments, runs stub image analysis
- Returns { ran: true, result: "..." } on success, { ran: false, message: "..." } otherwise
```

## Developer workflows

- **Add new agent:** Create `agents/myAgent.js` with `run()`, `supports()`, `requirements`. Register in server's `registered` array (lines ~130, ~210, ~280).
- **Test agent scoring:** POST to `/api/solve` with `"preview": true` to see scores without execution.
- **Debug secrets:** Edit `.env.local` directly or call `lib/secretStore.set()`. File is gitignored.
- **Session management:** Session cookie is `aai_sid` (HttpOnly). History persists in `memoryStore` map during server runtime (lost on restart).

## Important caveats & TODOs

- **Secrets in plaintext.** `.env.local` is never committed but exists on disk. Development-only pattern.
- **In-memory history.** Lost on server restart. Production would use a database.
- **Single agent execution.** Currently selects top agent by score. Multi-agent is not implemented.
- **Attachment analysis is stubbed.** Image processing returns dummy metadata (no real vision API).
- **No authentication.** Session cookie is not cryptographically signed; suitable for local dev only.

## File reference

Key files exemplifying patterns:
- [server/index.js](server/index.js#L115-L145) — agent scoring & selection
- [server/index.js](server/index.js#L72-L100) — SSE event streaming
- [agents/openaiAgent.js](agents/openaiAgent.js#L30-50) — secret key lookup pattern
- [agents/duckduckgoAgent.js](agents/duckduckgoAgent.js#L35-45) — supports() heuristic
- [lib/secretStore.js](lib/secretStore.js) — key-value persistence to `.env.local`
- [web/main.js](web/main.js#L60-90) — paste/drop image handling

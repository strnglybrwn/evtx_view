<!-- Purpose: concise, actionable guidance for AI coding agents working in this repository -->
# Copilot instructions — AAI

Purpose
- Help an AI agent be immediately productive in this repository. The only existing project artifact is `AAI/instructions.txt` which says: "create a simple web application with an input box and a submit button that uses a range of agents to solve for the challenge or query presented by the user." Use that as the source of truth.

Quick summary (what to build)
- Single-page web UI with a text input and a submit button.
- A lightweight server (or serverless endpoint) that accepts the user query and orchestrates a set of "agents" (small functions/services) to produce a combined result.

What is discoverable here
- `AAI/instructions.txt` — project goal and user-facing requirement. No source code, build or test scripts were found in the repo at time of writing.

Assumptions (stated explicitly)
- The repo is a skeleton. It's acceptable to introduce a conventional layout: `web/` for frontend, `api/` or `server/` for backend/orchestrator, and `agents/` for agent implementations. If you add these, document them in the repo.

Big-picture architecture (for the agent)
- Frontend (web/): form -> POST /api/solve
- Orchestrator (api/solve endpoint): receives { input: string } and invokes 0..N agents.
- Agents (agents/): small modules exporting a run(input) -> { output, score?, metadata? }.
- Response format: { result: string, agents: [{name, output, metadata}] }

Concrete patterns and file examples to follow
- Agent modules: export async function run(input) and return a compact object. Example filename: `agents/llm-summary.js`.
- API endpoint: `api/solve.js` (or `server/solve.ts`) should call agents in sequence or in parallel and merge outputs.
- UI entrypoint: `web/index.html` or `web/src/App.(js|tsx)` with a single input and submit flow wired to `/api/solve`.

Data contract (explicit example)
- Request: POST /api/solve
  - body: { "input": "<user query>" }
- Response: 200
  - body: { "result": "final combined answer", "agents": [{"name":"llm-summary","output":"...","durationMs":123}] }

Developer workflows (discoverable / conservative commands)
- If you create a Node-based prototype, include a `package.json` and use these conventional commands (document in the repo):
  - install dependencies: `npm install`
  - run dev server: `npm run dev` (or `node server/index.js`)
  - run tests: `npm test` (if tests added)
  Note: these are suggestions only — do not assume an existing toolchain without adding the files.

Project-specific conventions to use
- Keep agent modules tiny and composable. Each agent should focus on a single strategy (e.g., search, summarization, rule-based parsing).
- Agents must not depend on global state. Return plain JSON-serializable results.
- Put integration wiring in `api/` or `server/` and keep UI in `web/`.

Integration points and observability
- Log agent timings and errors in the orchestrator response under `agents[].metadata`.
- Return agent selection metadata so reviewers can see which agents were used and why.

When you update this file
- Merge gently: preserve `AAI/instructions.txt` content and any future notes in this file. If you change the assumed layout, add a short note explaining why.

If anything here is ambiguous
- Ask: which runtime (Node, Deno, Python) should be used or whether you should scaffold the frontend framework. Reference `AAI/instructions.txt` when making trade-offs.

End: please report back which files you created (paths) so the next agent can continue.

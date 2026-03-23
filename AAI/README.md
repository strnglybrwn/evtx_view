# AAI — local agent orchestration prototype

This repository is a small prototype that demonstrates an orchestrator pattern: a lightweight frontend sends user input (text and/or attachments) to a server that selects and runs small "agents" to produce a combined answer.

Quick start (local development)

Requirements: Node.js 16+ recommended.

**Option 1: Using startup script (recommended)**
```bash
# from repo root
./startup.sh start       # macOS/Linux
# or
startup.bat start        # Windows
# then open http://localhost:3000 in your browser
```

**Option 2: Manual setup**
```bash
# from repo root
npm install
# start server (serves web/ as static files)
npm run dev
# open http://localhost:3000 in your browser
```

## Environment Configuration

The server uses environment variables for configuration. Copy `.env.example` to `.env` and customize:

```bash
# from repo root
cp .env.example .env
```

**Configuration options:**
```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment (development or production)
LOG_LEVEL=info              # Logging level (error, warn, info, debug)
MAX_ATTACHMENTS=5           # Max file uploads per request
MAX_ATTACHMENT_BYTES=3145728 # Max size per file (~3MB)
HISTORY_LIMIT=10            # Max conversation history to retain
SESSION_TIMEOUT_MS=3600000  # Session timeout in milliseconds
REQUEST_TIMEOUT_MS=10000    # API request timeout
```

## Logging

The server uses structured logging via [Winston](https://github.com/winstonjs/winston):

- **Development:** Logs appear in console and files (`logs/error.log`, `logs/combined.log`)
- **Production:** Only file-based logs (no console output)
- **Log levels:** error, warn, info, debug

View logs in real-time:
```bash
# Unix
tail -f logs/combined.log

# Windows
Get-Content logs/combined.log -Wait
```

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals gracefully:
- Closes the HTTP server
- Allows in-flight requests to complete (30-second timeout)
- Cleans up resources

Startup scripts (`startup.sh` / `startup.bat`) handle this automatically.

## Testing

The project includes comprehensive test coverage using Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on code changes)
npm run test:watch

# Generate coverage report
npm test -- --coverage

# Debug tests
npm run test:debug
```

**Test structure:**
- Unit tests for agents and libraries in `__tests__/agents/`, `__tests__/lib/`
- Integration tests for API endpoints in `__tests__/server/`
- See [TESTING.md](TESTING.md) for detailed test documentation



### Commands

| Command | Effect |
|---------|--------|
| `start` | Install npm dependencies and launch the server at http://localhost:3000 |
| `stop` | Gracefully stop the running server |
| `restart` | Stop and restart the server (useful after code changes) |
| `status` | Check if the server is running and show the port |

### macOS/Linux examples

```bash
# Start the server (installs deps automatically)
./startup.sh start

# Check if running
./startup.sh status

# Restart after making changes
./startup.sh restart

# Stop the server
./startup.sh stop
```

### Windows examples

```cmd
REM Start the server
startup.bat start

REM Check if running
startup.bat status

REM Restart after making changes
startup.bat restart

REM Stop the server
startup.bat stop
```

### Logs and troubleshooting

- **Server logs:** The script logs output to `server.log` (Unix) or opens a dedicated window (Windows)
- **View logs (Unix):** `tail -f server.log`
- **PID tracking:** The script stores the process ID in `.aai.pid` (for Unix cleanup)
- **Port conflict:** If port 3000 is in use, modify `startup.sh` or set `PORT=<number> npm run dev`

### How it works

- **start:** Checks if a server is already running, installs dependencies via `npm install`, then launches `npm run dev` in the background
- **stop:** Finds and terminates the running server process, cleaning up the PID file
- **restart:** Stops gracefully, waits 1 second, then starts fresh (ensures clean state)
- **status:** Checks the PID file and verifies the process is still alive

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

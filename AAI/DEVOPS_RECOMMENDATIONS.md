# DevOps Recommendations for AAI

**Status:** Items 1-3 (High Priority) have been implemented. See "Implementation Progress" below.

Based on analysis of the current codebase, here are prioritized recommendations to improve deployment, reliability, and operational best practices.

## Implementation Progress

| # | Item | Status | Completed |
|----|------|--------|-----------|
| 1 | Environment Variable Configuration | ✅ Done | Yes |
| 2 | Graceful Shutdown Handling | ✅ Done | Yes |
| 3 | Structured Logging (Winston) | ✅ Done | Yes |
| 4 | Health Check Endpoint | 🔵 Next | — |
| 5 | Containerization (Docker) | 🔴 Pending | — |
| 6 | Testing & CI/CD Pipeline | 🔴 Pending | — |
| 7 | Process Manager (PM2) | 🔴 Pending | — |

## 🟢 Completed: High Priority Items

### 1. **Environment Variable Configuration** ✅
**Status:** IMPLEMENTED

All configuration now uses environment variables via `dotenv`:
```bash
# Copy .env.example to .env and customize
cp .env.example .env

# Available variables (see .env.example):
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
MAX_ATTACHMENTS=5
MAX_ATTACHMENT_BYTES=3145728
HISTORY_LIMIT=10
REQUEST_TIMEOUT_MS=10000
SESSION_TIMEOUT_MS=3600000
```

**Changes made:**
- Created `.env.example` with documented config schema
- Added `dotenv` to `package.json` dependencies
- Updated `server/index.js` to load config via `require('dotenv').config()`
- All hardcoded constants now read from `process.env` with defaults

**Benefit:** Configuration per environment without code changes; easier cloud deployment.

---

### 2. **Graceful Shutdown Handling** ✅
**Status:** IMPLEMENTED

Server now handles signals and allows in-flight requests to complete:

```javascript
// Handles SIGTERM and SIGINT
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

// Also catches uncaught exceptions and unhandled promise rejections
```

**How it works:**
1. Server receives `SIGTERM` or `SIGINT`
2. Stops accepting new connections
3. Waits up to 30 seconds for in-flight requests to complete
4. Logs all lifecycle events
5. Forcefully exits if timeout exceeded

**Benefit:** Prevents abrupt termination, protects session data, clean Kubernetes/Docker shutdowns.

---

### 3. **Structured Logging (Winston)** ✅
**Status:** IMPLEMENTED

Replaced ad-hoc `console.log` with professional logging via [Winston](https://github.com/winstonjs/winston):

**Logger features:**
- JSON-formatted logs (machine-parseable)
- Development mode: console + file output (colored, readable)
- Production mode: file-only output
- Log levels: error, warn, info, debug
- Separate error log (`logs/error.log`) and combined log (`logs/combined.log`)

**Usage in code:**
```javascript
logger.info('Server started', { port, environment: nodeEnv });
logger.warn('Deprecated endpoint used', { endpoint: '/old-api' });
logger.error('Agent failed', { agent: 'openaiAgent', error: err.message });
logger.debug('Request details', { userId, attachments: 5 });
```

**View logs:**
```bash
tail -f logs/combined.log        # Real-time
grep "error" logs/error.log      # Errors only
cat logs/combined.log | jq       # Pretty JSON
```

**Configuration:**
```bash
LOG_LEVEL=debug    # Verbose (development)
LOG_LEVEL=info     # Default (production)
NODE_ENV=production # Disables console output
```

**Benefit:** Debugging, monitoring, compliance-ready logs; integrates with log aggregators (ELK, Datadog, CloudWatch, Splunk).

---

### 4. **Health Check Endpoint**
**Current state:** Exists (`/health`), but doesn't check dependencies.

**Recommendation:** Enhance to validate critical systems:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    agents: {}
  };

  // Check if agents can be imported
  try {
    const agents = [openaiAgent, duckAgent, exampleAgent];
    agents.forEach(a => {
      health.agents[a.name] = a.supports ? 'ok' : 'missing';
    });
  } catch (err) {
    health.status = 'error';
    health.agentsError = err.message;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

**Benefit:** Kubernetes/Docker orchestrators can use this to determine if service is healthy; prevents traffic to broken instances.

---

## 🟡 Medium Priority (Operational Excellence)

### 5. **Containerization (Docker)**
**Current state:** No Docker support; setup requires Node.js 16+ locally.

**Recommendation:** Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY server/ ./server/
COPY agents/ ./agents/
COPY lib/ ./lib/
COPY web/ ./web/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000
CMD ["node", "server/index.js"]
```

**And `docker-compose.yml`:**
```yaml
version: '3.8'
services:
  aai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs  # Persist logs
```

**Benefit:** Consistent environment across dev/staging/production; enables cloud deployment (AWS ECS, GKE, etc.).

---

### 6. **Testing & CI/CD Pipeline**
**Current state:** No test files; no CI/CD workflow.

**Recommendation:** Add minimal test suite:
```bash
# package.json scripts
"test": "jest --coverage",
"test:watch": "jest --watch",
"lint": "eslint .",
"start": "node server/index.js",
"start:prod": "NODE_ENV=production node server/index.js"
```

**Create `.github/workflows/ci.yml`:**
```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build  # if applicable
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: docker build -t aai:latest .
      - run: docker push aai:latest  # push to registry
```

**Benefit:** Automated validation prevents broken deployments; fast feedback loop.

---

### 7. **Process Manager for Production**
**Current state:** Startup scripts handle local dev; no production process manager.

**Recommendation:** Use `PM2` for production:
```bash
npm install --save-dev pm2
```

**Create `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'aai',
      script: './server/index.js',
      instances: 'max',  // Utilize all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      error_file: './logs/error.log',
      out_file: './logs/combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      merge_logs: true
    }
  ]
};
```

**Usage:**
```bash
npm run prod:start    # pm2 start ecosystem.config.js
npm run prod:stop     # pm2 stop ecosystem.config.js
npm run prod:restart  # pm2 restart ecosystem.config.js
npm run prod:logs     # pm2 logs aai
```

**Benefit:** Automatic restart on crash, clustering across CPU cores, log aggregation.

---

## 🟢 Low Priority (Nice-to-have)

### 8. **Monitoring & Alerting**
Add Prometheus metrics or Datadog integration for:
- Request latency (p50, p95, p99)
- Agent success/error rates
- Memory and CPU usage
- Session count

```javascript
// Simple Prometheus metrics
const promClient = require('prom-client');
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});
```

---

### 9. **Security Hardening**
- Enable CORS headers explicitly (currently allows any origin)
- Add rate limiting (`express-rate-limit`)
- Use CSP headers for XSS protection
- Validate/sanitize user inputs (agent names, query strings)
- Use signed cookies instead of plaintext session IDs

---

### 10. **Database Persistence**
Current in-memory session history is lost on restart. For production:
- Use Redis for session caching (ephemeral, fast)
- Use PostgreSQL for conversation history (durable)
- Implement session serialization/deserialization

---

## Remaining High Priority Items

### 4. **Health Check Endpoint** (Next)
**Current state:** Exists but doesn't validate agent availability.

**Recommendation:** See section below for enhancement details.

---

## 🔴 Remaining Priority (Next to implement)

### 4. **Health Check Endpoint**
**Current state:** Exists (`/health`), but doesn't check dependencies.

**Recommendation:** Enhance to validate critical systems:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    agents: {}
  };

  // Check if agents can be imported
  try {
    const agents = [openaiAgent, duckAgent, exampleAgent];
    agents.forEach(a => {
      health.agents[a.name] = a.supports ? 'ok' : 'missing';
    });
  } catch (err) {
    health.status = 'error';
    health.agentsError = err.message;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

**Benefit:** Kubernetes/Docker orchestrators can use this to determine if service is healthy; prevents traffic to broken instances.

---

## Implementation Roadmap (Remaining)

| Priority | Item | Status | Effort | Impact |
|----------|------|--------|--------|--------|
| 🔴 High | Enhanced health check | 🔵 TODO | 1h | Required for orchestration |
| 🟡 Medium | Docker + compose | 🔴 TODO | 2h | Enables cloud deployment |
| 🟡 Medium | CI/CD pipeline | 🔴 TODO | 2h | Prevents broken releases |
| 🟡 Medium | PM2 setup | 🔴 TODO | 1h | Production reliability |
| 🟢 Low | Monitoring | 🔴 TODO | 4h | Operational visibility |
| 🟢 Low | Security hardening | 🔴 TODO | 3h | Reduces vulnerabilities |
| 🟢 Low | Database persistence | 🔴 TODO | 8h | Durability for production |

---

## Quick Next Steps

1. **Enhance health check** — Add agent validation (1h)
2. **Create Dockerfile** — Container support (2h)
3. **Set up GitHub Actions CI** — Automated testing (2h)

---

## Next Steps

1. **Start with high-priority items** (graceful shutdown, env config, logging)
2. **Add Docker** once baseline is stable
3. **Set up CI/CD** for automated testing and deployment
4. **Consider PM2** for production deployments beyond containers

Let me know which areas you'd like to implement first—I can provide code templates or help with the setup.

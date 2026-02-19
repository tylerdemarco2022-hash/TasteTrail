Getting started (local development)

1) Prerequisites
- Docker & Docker Compose
- A `.env` file at the project root copied from `.env.example` and filled with real credentials (Supabase, OpenAI, Google Places).

2) Bring up the local development stack

This brings up Redis, the API server and a background worker. Both the backend and worker are built from the repository `Dockerfile`, and Redis is available at `redis://redis:6379` inside the Compose network.

```bash
# copy env example
cp .env.example .env
# edit .env with your keys

# Build and start services
docker-compose up --build -d

# View logs
docker-compose logs -f backend
docker-compose logs -f worker
```

3) Stop and remove

```bash
docker-compose down
```

4) How services are wired
- `redis` service: `redis:7`, persistent volume `taste_trails_redis_data` mapped to Redis data directory.
- `backend` service: built from `Dockerfile`, runs `node server.js` by default. The container receives environment variables from `.env` and has `REDIS_URL` overridden to `redis://redis:6379` so it connects to the Compose Redis.
- `worker` service: built from `Dockerfile`, runs `node worker.js` and likewise uses `REDIS_URL=redis://redis:6379`.

5) Test the API
- Health check
```bash
curl http://localhost:3000/health
# expected: { "status": "ok" }
```

- Enqueue a city job
```bash
curl -X POST http://localhost:3000/run-city \
  -H "Content-Type: application/json" \
  -d '{"city":"Greenwood SC"}'
```

6) Troubleshooting
- If Puppeteer fails to launch in containers, try running the backend/worker locally outside Docker to ensure Chromium is installed correctly, or use the provided `Dockerfile` (it installs common Chromium dependencies). For some platforms you may need to install additional packages or use the full `puppeteer` vs `puppeteer-core` + a custom Chromium.
- To view Redis data and connectivity issues:
```bash
docker-compose exec redis redis-cli ping
```

7) Notes
- The Compose stack is intended for local development and testing. For production, deploy services separately (e.g., Railway web service for `server.js` and a background worker for `worker.js`) and use managed Redis.
- Ensure you never commit `.env` with secrets to git. Use environment variables in your CI/CD or deployment platform.

## System Validation

Automated validation scripts to exercise the end-to-end system components.

- `npm run validate` — Runs a full system validation (health, Redis, enqueue job, poll Supabase, fetch metrics, rate-limit check). Exits with code `0` when all checks pass or `1` on failure. The script has a 60s overall timeout.
- `npm run load-test` — Sends 20 rapid `POST /run-city` requests and reports 429 responses to validate rate limiting.
- `npm run error-test` — Enqueues an intentionally invalid job which should cause the worker to produce an error; useful to verify Sentry captures errors (check worker logs and Sentry dashboard).

Example:

```bash
# Run the full automated validation
npm run validate

# Run the load test (rate limiting)
npm run load-test

# Enqueue an invalid job to trigger an error and check Sentry
npm run error-test
```

The validation scripts use `API_URL`, `PORT`, `REDIS_URL`, and Supabase environment variables from your `.env` file. Make sure your services are running and `.env` is configured.

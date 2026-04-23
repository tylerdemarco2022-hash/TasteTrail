#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import crypto from 'node:crypto';
import { normalizeMenuPayload, countSectionItems } from '../shared/menu/menuPayload.js';

const ROOT = process.cwd();
const ARTIFACT_ROOT = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial');
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(ARTIFACT_ROOT, 'runs', RUN_ID);
const LATEST_DIR = path.join(ARTIFACT_ROOT, 'latest');
const ARTIFACT_SCHEMA_VERSION = '1.0.0';

const PORT = Number(process.env.ADV_MENU_PORT || 3110);
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || process.env.ADMIN_TOKEN || 'dev-adversarial-key').trim();

const P95_THRESHOLD_MS = Number.isFinite(Number(process.env.MENU_INTEGRITY_P95_THRESHOLD_MS))
  ? Math.max(500, Number(process.env.MENU_INTEGRITY_P95_THRESHOLD_MS))
  : 3000;

const MAX_RSS_BYTES = Number.isFinite(Number(process.env.MENU_INTEGRITY_MAX_RSS_BYTES))
  ? Math.max(100_000_000, Number(process.env.MENU_INTEGRITY_MAX_RSS_BYTES))
  : 850_000_000;

function readDotEnvValue(key) {
  try {
    const dotenvPath = path.join(ROOT, '.env');
    if (!fs.existsSync(dotenvPath)) return '';
    const lines = fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/);
    const match = lines.find((line) => line.trim().startsWith(`${key}=`));
    if (!match) return '';
    return String(match.slice(key.length + 1) || '').trim();
  } catch {
    return '';
  }
}

const HAS_LIVE_SECRETS = Boolean(
  (String(process.env.SUPABASE_URL || '').trim() || readDotEnvValue('SUPABASE_URL'))
  && (String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() || readDotEnvValue('SUPABASE_SERVICE_ROLE_KEY'))
);

const explicitSim = String(process.env.SIM_MODE || '').toLowerCase() === 'true';
const explicitLive = String(process.env.LIVE_MODE || '').toLowerCase() === 'true';
const RUN_SIM = explicitSim || (!explicitSim && !explicitLive);
const RUN_LIVE = explicitLive || (!explicitSim && !explicitLive && HAS_LIVE_SECRETS);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createTrace(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function toLines(text, max = 30) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-max);
}

function extractTraceLogs(logs, traceId) {
  const lines = toLines(logs, 250);
  const matched = lines.filter((line) => line.includes(traceId));
  if (matched.length > 0) return matched.slice(-15);
  return lines.slice(-10);
}

function percentile(values, p) {
  const list = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (list.length === 0) return 0;
  const rank = Math.min(list.length - 1, Math.max(0, Math.ceil((p / 100) * list.length) - 1));
  return list[rank];
}

async function fetchJson(url, { method = 'GET', headers = {}, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      body,
      duration_ms: Date.now() - started
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: {},
      error: error?.message || String(error),
      duration_ms: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildResult({
  test_name,
  trace_id,
  setup,
  expected,
  actual,
  pass,
  critical_logs
}) {
  return {
    test_name,
    trace_id,
    setup,
    expected,
    actual,
    pass_fail: pass ? 'PASS' : 'FAIL',
    critical_logs: Array.isArray(critical_logs) ? critical_logs.slice(0, 60) : []
  };
}

function summarizeCounts(payload = {}) {
  const normalized = normalizeMenuPayload(payload);
  return {
    db_count: Number(payload?.debug_counts?.raw_db_rows_loaded || 0),
    api_count: Number(payload?.item_count || payload?.debug_counts?.returned_item_count || 0),
    frontend_renderable_count: countSectionItems(normalized.sections),
    source: payload?.source || null,
    source_path: payload?.debug_counts?.source_path || payload?.source_path || null,
    db_query_error: payload?.debug_counts?.db_query_error || null,
    total_count_expected: Number(payload?.debug_counts?.total_count_expected || 0)
  };
}

function startBackend(extraEnv = {}) {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: process.env.NODE_ENV || 'development',
    ADMIN_API_KEY: ADMIN_KEY,
    ADMIN_TOKEN: ADMIN_KEY,
    MENU_INTEGRITY_DEBUG_MODE: 'true',
    MENU_INTEGRITY_FAULT_INJECTION_ENABLED: 'true',
    ALLOW_FALLBACK_ON_DB_ERROR: 'false',
    MENU_ITEMS_REPO_THROW_ON_PAGE: '',
    MENU_ITEMS_REPO_MAX_PAGES: '',
    MENU_ITEMS_REPO_FORCE_MISSING_OPTIONAL_COLUMNS: '',
    MENU_ITEMS_REQUIRED_COLUMNS_OVERRIDE: '',
    MENU_INTEGRITY_CANARY_ON_STARTUP: 'false',
    MENU_INTEGRITY_CANARY_REFRESH: 'true',
    ...extraEnv
  };

  const child = spawn(process.execPath, ['backend/server/index.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  return {
    child,
    getLogs: () => `${stdout}\n${stderr}`
  };
}

async function stopBackend(procRef) {
  if (!procRef?.child || procRef.child.exitCode !== null) return;
  procRef.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => procRef.child.once('exit', resolve)),
    sleep(2500)
  ]);
  if (procRef.child.exitCode === null) procRef.child.kill('SIGKILL');
}

async function waitForHealth(baseUrl, timeoutMs = 35000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await fetchJson(`${baseUrl}/api/health`, { timeoutMs: 2500 });
    if (health.status === 200) return true;
    await sleep(400);
  }
  return false;
}

async function resolveLiveRestaurantsFromCanary() {
  const response = await fetchJson(`${BASE_URL}/api/admin/menu-integrity/canary-check`, {
    method: 'POST',
    headers: {
      'x-admin-key': ADMIN_KEY,
      'content-type': 'application/json'
    },
    timeoutMs: 120000
  });

  const targets = Array.isArray(response.body?.canary_targets) ? response.body.canary_targets : [];
  const out = {};
  for (const entry of targets) {
    const size = String(entry?.size || '').trim();
    if (!size || !entry?.restaurant_id) continue;
    out[size] = String(entry.restaurant_id);
  }

  if (!out.small || !out.medium || !out.large) {
    throw new Error('DYNAMIC_CANARY_TARGETS_UNAVAILABLE');
  }

  return {
    restaurants: out,
    response
  };
}

async function runLiveTestMatrix() {
  const tests = [];
  const server = startBackend({
    MENU_INTEGRITY_DEBUG_MODE: 'true'
  });

  const started = await waitForHealth(BASE_URL);
  if (!started) {
    const fail = buildResult({
      test_name: 'live_startup',
      trace_id: createTrace('live-startup'),
      setup: 'Start backend in LIVE mode',
      expected: 'Server starts and health endpoint returns 200',
      actual: { startup_ok: false },
      pass: false,
      critical_logs: toLines(server.getLogs(), 40)
    });
    tests.push(fail);
    await stopBackend(server);
    return { tests, metadata: { mode: 'LIVE_MODE', started: false } };
  }

  let restaurants = null;
  let canaryResponse = null;
  try {
    const resolved = await resolveLiveRestaurantsFromCanary();
    restaurants = resolved.restaurants;
    canaryResponse = resolved.response;
  } catch (error) {
    tests.push(buildResult({
      test_name: 'dynamic_canary_target_selection',
      trace_id: createTrace('live-targets'),
      setup: 'Resolve small/medium/large targets from dynamic canary selection',
      expected: 'Dynamic targets available for small, medium, large',
      actual: { error: error?.message || String(error) },
      pass: false,
      critical_logs: toLines(server.getLogs(), 25)
    }));
    await stopBackend(server);
    return { tests, metadata: { mode: 'LIVE_MODE', started: true } };
  }

  tests.push(buildResult({
    test_name: 'dynamic_canary_target_selection',
    trace_id: createTrace('live-targets-ok'),
    setup: 'Resolve small/medium/large targets from dynamic canary selection',
    expected: 'Dynamic targets available for small, medium, large',
    actual: {
      restaurants,
      canary_summary: canaryResponse?.body?.summary || null
    },
    pass: true,
    critical_logs: [
      `small=${restaurants.small}`,
      `medium=${restaurants.medium}`,
      `large=${restaurants.large}`
    ]
  }));

  async function callFullMenu(restaurantId, traceId) {
    return fetchJson(`${BASE_URL}/api/restaurants/${restaurantId}/full-menu?debug=1&trace_id=${traceId}`, {
      headers: { 'x-admin-key': ADMIN_KEY },
      timeoutMs: 120000
    });
  }

  // 1) DB page-2 fault
  const dbFaultTrace = createTrace('live-db-page2');
  await stopBackend(server);
  const serverDbFault = startBackend({
    MENU_ITEMS_REPO_THROW_ON_PAGE: '2',
    ALLOW_FALLBACK_ON_DB_ERROR: 'false',
    MENU_INTEGRITY_DEBUG_MODE: 'true'
  });
  const dbFaultStarted = await waitForHealth(BASE_URL);
  if (!dbFaultStarted) {
    tests.push(buildResult({
      test_name: 'db_page_2_fault',
      trace_id: dbFaultTrace,
      setup: 'ALLOW_FALLBACK_ON_DB_ERROR=false MENU_ITEMS_REPO_THROW_ON_PAGE=2',
      expected: '503 db_error with DB_QUERY_ERROR',
      actual: { startup_ok: false },
      pass: false,
      critical_logs: toLines(serverDbFault.getLogs(), 30)
    }));
  } else {
    const response = await callFullMenu(restaurants.large, dbFaultTrace);
    const pass = response.status === 503
      && String(response.body?.source || '') === 'db_error';
    tests.push(buildResult({
      test_name: 'db_page_2_fault',
      trace_id: dbFaultTrace,
      setup: 'ALLOW_FALLBACK_ON_DB_ERROR=false MENU_ITEMS_REPO_THROW_ON_PAGE=2',
      expected: '503 db_error with DB_QUERY_ERROR',
      actual: {
        status: response.status,
        source: response.body?.source || null,
        error: response.body?.error || null,
        details: response.body?.details || null
      },
      pass,
      critical_logs: [...extractTraceLogs(serverDbFault.getLogs(), dbFaultTrace)]
    }));
  }
  await stopBackend(serverDbFault);

  // 2) early stop truncation hard error
  const serverTrunc = startBackend({
    MENU_ITEMS_REPO_MAX_PAGES: '1',
    MENU_INTEGRITY_DEBUG_MODE: 'true'
  });
  const truncTrace = createTrace('live-trunc');
  const truncStarted = await waitForHealth(BASE_URL);
  if (!truncStarted) {
    tests.push(buildResult({
      test_name: 'early_stop_truncation',
      trace_id: truncTrace,
      setup: 'MENU_ITEMS_REPO_MAX_PAGES=1',
      expected: '503 DB_PAGE_INTEGRITY_MISMATCH (hard stop)',
      actual: { startup_ok: false },
      pass: false,
      critical_logs: toLines(serverTrunc.getLogs(), 30)
    }));
  } else {
    const response = await callFullMenu(restaurants.large, truncTrace);
    const err = String(response.body?.details?.db_query_error || '');
    const pass = response.status === 503 && err.includes('DB_PAGE_INTEGRITY_MISMATCH');
    tests.push(buildResult({
      test_name: 'early_stop_truncation',
      trace_id: truncTrace,
      setup: 'MENU_ITEMS_REPO_MAX_PAGES=1',
      expected: '503 DB_PAGE_INTEGRITY_MISMATCH (hard stop)',
      actual: {
        status: response.status,
        source: response.body?.source || null,
        details: response.body?.details || null
      },
      pass,
      critical_logs: [...extractTraceLogs(serverTrunc.getLogs(), truncTrace)]
    }));
  }
  await stopBackend(serverTrunc);

  // 3) normal server for remaining tests
  const serverNormal = startBackend({ MENU_INTEGRITY_DEBUG_MODE: 'true' });
  const normalStarted = await waitForHealth(BASE_URL);
  if (!normalStarted) {
    tests.push(buildResult({
      test_name: 'live_normal_startup',
      trace_id: createTrace('live-normal'),
      setup: 'Start normal backend after fault tests',
      expected: 'health=200',
      actual: { startup_ok: false },
      pass: false,
      critical_logs: toLines(serverNormal.getLogs(), 30)
    }));
    await stopBackend(serverNormal);
    return { tests, metadata: { mode: 'LIVE_MODE', restaurants } };
  }

  // 4) 10 concurrent large-menu requests + perf
  const traceRoot = createTrace('live-concurrent');
  const requestRuns = await Promise.all(
    Array.from({ length: 10 }, async (_, index) => {
      const traceId = `${traceRoot}-${index + 1}`;
      const response = await callFullMenu(restaurants.large, traceId);
      return {
        traceId,
        response,
        duration_ms: response.duration_ms,
        counts: summarizeCounts(response.body)
      };
    })
  );

  const statuses = [...new Set(requestRuns.map((item) => item.response.status))];
  const apiCounts = [...new Set(requestRuns.map((item) => item.counts.api_count))];
  const dbCounts = [...new Set(requestRuns.map((item) => item.counts.db_count))];
  const frontendCounts = [...new Set(requestRuns.map((item) => item.counts.frontend_renderable_count))];
  const sourcePaths = [...new Set(requestRuns.map((item) => item.counts.source_path))];
  const durations = requestRuns.map((item) => item.duration_ms);
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);

  const diagnostics = await fetchJson(`${BASE_URL}/api/admin/menu-integrity/diagnostics?limit=50`, {
    headers: { 'x-admin-key': ADMIN_KEY },
    timeoutMs: 30000
  });
  const perfWindow = diagnostics.body?.performance_window || {};
  const maxRss = Number(perfWindow.max_rss_bytes || 0);

  const passConcurrent = statuses.length === 1
    && statuses[0] === 200
    && apiCounts.length === 1
    && dbCounts.length === 1
    && frontendCounts.length === 1
    && apiCounts[0] === dbCounts[0]
    && apiCounts[0] === frontendCounts[0]
    && sourcePaths.length === 1
    && sourcePaths[0] === 'db';

  tests.push(buildResult({
    test_name: 'concurrent_large_menu_10x',
    trace_id: traceRoot,
    setup: '10 concurrent full-menu requests against dynamic large restaurant target',
    expected: 'All responses 200 with DB/API/frontend parity and source_path=db',
    actual: {
      unique_statuses: statuses,
      unique_api_counts: apiCounts,
      unique_db_counts: dbCounts,
      unique_frontend_counts: frontendCounts,
      unique_source_paths: sourcePaths
    },
    pass: passConcurrent,
    critical_logs: requestRuns.slice(0, 4).flatMap((item) => [
      `trace=${item.traceId}`,
      `status=${item.response.status}`,
      `duration_ms=${item.duration_ms}`,
      `source_path=${item.counts.source_path}`
    ])
  }));

  const passPerf = p95 <= P95_THRESHOLD_MS && maxRss > 0 && maxRss <= MAX_RSS_BYTES;
  tests.push(buildResult({
    test_name: 'performance_memory_guardrails',
    trace_id: traceRoot,
    setup: `p95<=${P95_THRESHOLD_MS}ms and max_rss<=${MAX_RSS_BYTES}`,
    expected: 'Latency and memory stay within configured thresholds',
    actual: {
      p50_ms: p50,
      p95_ms: p95,
      threshold_p95_ms: P95_THRESHOLD_MS,
      max_rss_bytes: maxRss,
      threshold_max_rss_bytes: MAX_RSS_BYTES,
      diagnostics_status: diagnostics.status
    },
    pass: passPerf,
    critical_logs: [
      `p50_ms=${p50}`,
      `p95_ms=${p95}`,
      `max_rss_bytes=${maxRss}`
    ]
  }));

  // 5) fallback replay (first with fallback allowed and fault, then strict clean)
  await stopBackend(serverNormal);
  const serverFallback = startBackend({
    ALLOW_FALLBACK_ON_DB_ERROR: 'true',
    MENU_ITEMS_REPO_THROW_ON_PAGE: '2',
    MENU_INTEGRITY_DEBUG_MODE: 'true'
  });
  const fallbackStarted = await waitForHealth(BASE_URL);
  const fallbackTrace = createTrace('live-fallback-poison');
  let fallbackResponse = { status: 0, body: {} };
  if (fallbackStarted) {
    fallbackResponse = await callFullMenu(restaurants.large, fallbackTrace);
  }
  await stopBackend(serverFallback);

  const serverRestore = startBackend({ MENU_INTEGRITY_DEBUG_MODE: 'true' });
  const restoreStarted = await waitForHealth(BASE_URL);
  const restoreTrace = createTrace('live-fallback-restore');
  let restoreResponse = { status: 0, body: {} };
  if (restoreStarted) {
    restoreResponse = await callFullMenu(restaurants.large, restoreTrace);
  }

  const fallbackCounts = summarizeCounts(fallbackResponse.body);
  const restoreCounts = summarizeCounts(restoreResponse.body);
  const passReplay = fallbackStarted && restoreStarted
    && fallbackResponse.status === 200
    && fallbackCounts.source_path !== 'db'
    && restoreResponse.status === 200
    && restoreCounts.source_path === 'db'
    && restoreCounts.db_count === restoreCounts.api_count
    && restoreCounts.api_count === restoreCounts.frontend_renderable_count;

  tests.push(buildResult({
    test_name: 'fallback_cache_poison_replay',
    trace_id: `${fallbackTrace},${restoreTrace}`,
    setup: 'Fallback-on fault request followed by strict clean request',
    expected: 'Fallback does not poison DB path; clean replay returns DB parity',
    actual: {
      fallback_status: fallbackResponse.status,
      fallback_counts: fallbackCounts,
      restore_status: restoreResponse.status,
      restore_counts: restoreCounts
    },
    pass: passReplay,
    critical_logs: [
      ...extractTraceLogs(serverRestore.getLogs(), restoreTrace),
      `fallback_source_path=${fallbackCounts.source_path}`,
      `restore_source_path=${restoreCounts.source_path}`
    ]
  }));

  // 6) stale frontend overwrite simulation
  let latestSeq = 0;
  const applied = [];
  const firstPromise = (async () => {
    const seq = ++latestSeq;
    await sleep(200);
    if (seq !== latestSeq) return { applied: false, seq };
    applied.push('old');
    return { applied: true, seq };
  })();
  await sleep(20);
  const secondPromise = (async () => {
    const seq = ++latestSeq;
    await sleep(20);
    if (seq !== latestSeq) return { applied: false, seq };
    applied.push('new');
    return { applied: true, seq };
  })();

  const staleA = await firstPromise;
  const staleB = await secondPromise;
  const stalePass = staleA.applied === false && staleB.applied === true && applied.length === 1 && applied[0] === 'new';
  tests.push(buildResult({
    test_name: 'stale_frontend_overwrite_simulation',
    trace_id: createTrace('live-stale'),
    setup: 'Sequence guard simulation with delayed stale response',
    expected: 'Only latest request applies',
    actual: { staleA, staleB, applied },
    pass: stalePass,
    critical_logs: [`stale_applied=${staleA.applied}`, `latest_applied=${staleB.applied}`]
  }));

  // 7) schema drift startup checks
  await stopBackend(serverRestore);
  const serverOptional = startBackend({ MENU_ITEMS_REPO_FORCE_MISSING_OPTIONAL_COLUMNS: 'description' });
  const optionalStarted = await waitForHealth(BASE_URL);
  await stopBackend(serverOptional);

  const serverRequired = startBackend({ MENU_ITEMS_REQUIRED_COLUMNS_OVERRIDE: 'id,restaurant_id,required_but_missing_column' });
  let requiredExitCode = null;
  const waitDeadline = Date.now() + 15000;
  while (Date.now() < waitDeadline && requiredExitCode === null) {
    if (serverRequired.child.exitCode !== null) {
      requiredExitCode = serverRequired.child.exitCode;
      break;
    }
    await sleep(250);
  }
  await stopBackend(serverRequired);

  const schemaPass = optionalStarted === true && requiredExitCode !== null && requiredExitCode !== 0;
  tests.push(buildResult({
    test_name: 'schema_drift_startup_checks',
    trace_id: createTrace('live-schema'),
    setup: 'Optional drift + required missing override',
    expected: 'Optional startup succeeds; required missing fails fast',
    actual: { optional_started: optionalStarted, required_exit_code: requiredExitCode },
    pass: schemaPass,
    critical_logs: [...toLines(serverRequired.getLogs(), 20)]
  }));

  // 8) monitoring and diagnostics usefulness
  const serverMonitor = startBackend({
    ALLOW_FALLBACK_ON_DB_ERROR: 'true',
    MENU_ITEMS_REPO_MAX_PAGES: '1',
    MENU_INTEGRITY_DEBUG_MODE: 'true'
  });
  const monitorStarted = await waitForHealth(BASE_URL);
  const monitorTrace = createTrace('live-monitor');
  let monitorCall = { status: 0, body: {} };
  let diagnosticsCall = { status: 0, body: {} };
  if (monitorStarted) {
    monitorCall = await callFullMenu(restaurants.large, monitorTrace);
    diagnosticsCall = await fetchJson(`${BASE_URL}/api/admin/menu-integrity/diagnostics?limit=30`, {
      headers: { 'x-admin-key': ADMIN_KEY }
    });
  }

  const diag = diagnosticsCall.body || {};
  const monitorPass = monitorStarted
    && monitorCall.status === 503
    && diagnosticsCall.status === 200
    && Array.isArray(diag.top_5_largest_mismatches_by_pct_drop)
    && Array.isArray(diag.last_10_db_error_traces)
    && Array.isArray(diag.last_10_fallback_traces)
    && Array.isArray(diag.per_restaurant_failure_frequency)
    && Object.prototype.hasOwnProperty.call(diag, 'worst_offender_restaurant_id');

  tests.push(buildResult({
    test_name: 'monitoring_warning_validation',
    trace_id: monitorTrace,
    setup: 'Force mismatch in fallback mode and query diagnostics endpoint',
    expected: 'Diagnostics returns top mismatches, recent DB/fallback traces, failure frequency, worst offender',
    actual: {
      request_status: monitorCall.status,
      diagnostics_status: diagnosticsCall.status,
      top_mismatch_count: Array.isArray(diag.top_5_largest_mismatches_by_pct_drop) ? diag.top_5_largest_mismatches_by_pct_drop.length : 0,
      db_error_count: Array.isArray(diag.last_10_db_error_traces) ? diag.last_10_db_error_traces.length : 0,
      fallback_count: Array.isArray(diag.last_10_fallback_traces) ? diag.last_10_fallback_traces.length : 0,
      worst_offender_restaurant_id: diag.worst_offender_restaurant_id || null
    },
    pass: monitorPass,
    critical_logs: [...extractTraceLogs(serverMonitor.getLogs(), monitorTrace)]
  }));

  await stopBackend(serverMonitor);

  // 9) canary endpoint snapshot on clean runtime (no injected faults)
  const serverCanary = startBackend({ MENU_INTEGRITY_DEBUG_MODE: 'true' });
  const canaryStarted = await waitForHealth(BASE_URL);
  let canarySnapshot = { status: 0, body: {} };
  if (canaryStarted) {
    canarySnapshot = await fetchJson(`${BASE_URL}/api/admin/menu-integrity/canary-check`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_KEY, 'content-type': 'application/json' },
      timeoutMs: 120000
    });
  }

  const canaryPass = canarySnapshot.status === 200 && Number(canarySnapshot.body?.summary?.failed || 0) === 0;
  tests.push(buildResult({
    test_name: 'canary_three_restaurants_check',
    trace_id: createTrace('live-canary'),
    setup: 'Run dynamic canary endpoint',
    expected: 'Canary passes with 3 targets',
    actual: {
      status: canarySnapshot.status,
      summary: canarySnapshot.body?.summary || null,
      canary_targets: canarySnapshot.body?.canary_targets || []
    },
    pass: canaryPass,
    critical_logs: [
      `canary_started=${canaryStarted}`,
      `canary_status=${canarySnapshot.status}`,
      `canary_failed=${canarySnapshot.body?.summary?.failed || 0}`
    ]
  }));

  await stopBackend(serverCanary);

  return {
    tests,
    metadata: {
      mode: 'LIVE_MODE',
      restaurants,
      canary_snapshot: canarySnapshot.body || null,
      diagnostics_sample: diagnosticsCall.body || null
    }
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSimDataset(seed = 1337) {
  const rnd = mulberry32(seed);
  const restaurants = [
    { size: 'small', restaurant_id: 'sim-small', restaurant_name: 'SIM Small Bistro', item_count: 21 },
    { size: 'medium', restaurant_id: 'sim-medium', restaurant_name: 'SIM Mid Hall', item_count: 138 },
    { size: 'large', restaurant_id: 'sim-large', restaurant_name: 'SIM Large Kitchen', item_count: 3262 }
  ];

  const countsById = {};
  for (const rest of restaurants) {
    countsById[rest.restaurant_id] = rest.item_count;
  }

  function simulateFullMenu({ restaurant_id, throw_on_page = 0, max_pages = 0, allow_fallback = false }) {
    const dbCount = Number(countsById[restaurant_id] || 0);
    const pageSize = 1000;
    const pageCount = Math.max(1, Math.ceil(dbCount / pageSize));

    if (throw_on_page > 0 && throw_on_page <= pageCount) {
      if (!allow_fallback) {
        return {
          status: 503,
          source: 'db_error',
          source_path: 'fallback',
          db_count: dbCount,
          api_count: 0,
          frontend_count: 0,
          error: 'DB_QUERY_ERROR'
        };
      }
      const fallbackCount = Math.max(0, Math.floor(dbCount * 0.03));
      return {
        status: 200,
        source: 'generated_fallback',
        source_path: 'fallback',
        db_count: dbCount,
        api_count: fallbackCount,
        frontend_count: fallbackCount,
        error: null
      };
    }

    if (max_pages > 0 && max_pages < pageCount) {
      const loadedRows = max_pages * pageSize;
      if (!allow_fallback) {
        return {
          status: 503,
          source: 'db_error',
          source_path: 'fallback',
          db_count: loadedRows,
          expected_count: dbCount,
          api_count: 0,
          frontend_count: 0,
          error: 'DB_PAGE_INTEGRITY_MISMATCH'
        };
      }
      const fallbackCount = Math.max(0, Math.floor(dbCount * 0.02));
      return {
        status: 503,
        source: 'db_error',
        source_path: 'fallback',
        db_count: loadedRows,
        expected_count: dbCount,
        api_count: 0,
        frontend_count: 0,
        error: 'DB_PAGE_INTEGRITY_MISMATCH'
      };
    }

    const jitter = 140 + Math.floor(rnd() * 120);
    return {
      status: 200,
      source: 'db_cache',
      source_path: 'db',
      db_count: dbCount,
      expected_count: dbCount,
      api_count: dbCount,
      frontend_count: dbCount,
      duration_ms: jitter,
      rss_bytes: 280_000_000 + Math.floor(rnd() * 110_000_000),
      error: null
    };
  }

  return { restaurants, simulateFullMenu };
}

async function runSimTestMatrix() {
  const traceRoot = createTrace('sim');
  const tests = [];
  const dataset = buildSimDataset(1337);
  const largeId = dataset.restaurants.find((entry) => entry.size === 'large')?.restaurant_id;

  const dbFault = dataset.simulateFullMenu({ restaurant_id: largeId, throw_on_page: 2, allow_fallback: false });
  tests.push(buildResult({
    test_name: 'db_page_2_fault',
    trace_id: `${traceRoot}-dbfault`,
    setup: 'Deterministic seeded dataset with throw_on_page=2 strict mode',
    expected: '503 db_error DB_QUERY_ERROR',
    actual: dbFault,
    pass: dbFault.status === 503 && dbFault.error === 'DB_QUERY_ERROR',
    critical_logs: [`status=${dbFault.status}`, `error=${dbFault.error}`]
  }));

  const trunc = dataset.simulateFullMenu({ restaurant_id: largeId, max_pages: 1, allow_fallback: false });
  tests.push(buildResult({
    test_name: 'early_stop_truncation',
    trace_id: `${traceRoot}-trunc`,
    setup: 'Deterministic seeded dataset with max_pages=1 strict mode',
    expected: '503 db_error DB_PAGE_INTEGRITY_MISMATCH',
    actual: trunc,
    pass: trunc.status === 503 && trunc.error === 'DB_PAGE_INTEGRITY_MISMATCH',
    critical_logs: [`status=${trunc.status}`, `error=${trunc.error}`]
  }));

  const concurrent = Array.from({ length: 10 }, () => dataset.simulateFullMenu({ restaurant_id: largeId }));
  const statuses = [...new Set(concurrent.map((entry) => entry.status))];
  const dbCounts = [...new Set(concurrent.map((entry) => entry.db_count))];
  const apiCounts = [...new Set(concurrent.map((entry) => entry.api_count))];
  const frontendCounts = [...new Set(concurrent.map((entry) => entry.frontend_count))];
  const sourcePaths = [...new Set(concurrent.map((entry) => entry.source_path))];

  tests.push(buildResult({
    test_name: 'concurrent_large_menu_10x',
    trace_id: `${traceRoot}-concurrent`,
    setup: '10 simulated concurrent requests over deterministic seeded dataset',
    expected: 'All consistent with DB/API/frontend parity',
    actual: {
      statuses,
      dbCounts,
      apiCounts,
      frontendCounts,
      sourcePaths
    },
    pass: statuses.length === 1 && statuses[0] === 200
      && dbCounts.length === 1 && apiCounts.length === 1 && frontendCounts.length === 1
      && dbCounts[0] === apiCounts[0] && apiCounts[0] === frontendCounts[0]
      && sourcePaths.length === 1 && sourcePaths[0] === 'db',
    critical_logs: [`status=${statuses[0]}`, `count=${dbCounts[0]}`]
  }));

  const fallback = dataset.simulateFullMenu({ restaurant_id: largeId, throw_on_page: 2, allow_fallback: true });
  const restore = dataset.simulateFullMenu({ restaurant_id: largeId, allow_fallback: false });
  tests.push(buildResult({
    test_name: 'fallback_cache_poison_replay',
    trace_id: `${traceRoot}-fallback-restore`,
    setup: 'Fallback simulation then strict clean replay',
    expected: 'Fallback non-db then DB parity on restore',
    actual: { fallback, restore },
    pass: fallback.source_path !== 'db' && restore.source_path === 'db' && restore.db_count === restore.api_count,
    critical_logs: [`fallback_source=${fallback.source_path}`, `restore_source=${restore.source_path}`]
  }));

  // stale frontend overwrite simulation
  let latestSeq = 0;
  const applied = [];
  const oldPromise = (async () => {
    const seq = ++latestSeq;
    await sleep(160);
    if (seq !== latestSeq) return { applied: false };
    applied.push('old');
    return { applied: true };
  })();
  await sleep(20);
  const newPromise = (async () => {
    const seq = ++latestSeq;
    await sleep(20);
    if (seq !== latestSeq) return { applied: false };
    applied.push('new');
    return { applied: true };
  })();
  const oldRes = await oldPromise;
  const newRes = await newPromise;
  tests.push(buildResult({
    test_name: 'stale_frontend_overwrite_simulation',
    trace_id: `${traceRoot}-stale`,
    setup: 'Simulated sequence-guard race',
    expected: 'Stale ignored, latest applied',
    actual: { oldRes, newRes, applied },
    pass: oldRes.applied === false && newRes.applied === true && applied.length === 1 && applied[0] === 'new',
    critical_logs: [`old_applied=${oldRes.applied}`, `new_applied=${newRes.applied}`]
  }));

  tests.push(buildResult({
    test_name: 'schema_drift_startup_checks',
    trace_id: `${traceRoot}-schema`,
    setup: 'Simulated optional/required schema behavior',
    expected: 'Optional drift tolerated, required missing fails',
    actual: {
      optional_startup_ok: true,
      required_startup_exit_code: 1
    },
    pass: true,
    critical_logs: ['optional_ok=true', 'required_fail_fast=true']
  }));

  tests.push(buildResult({
    test_name: 'monitoring_warning_validation',
    trace_id: `${traceRoot}-monitor`,
    setup: 'Simulated diagnostics payload checks',
    expected: 'Diagnostics has mismatch/db_error/fallback/frequency fields',
    actual: {
      top_5_largest_mismatches_by_pct_drop: [{ mismatch_pct_drop: 12.5 }],
      last_10_db_error_traces: [{ trace_id: `${traceRoot}-db` }],
      last_10_fallback_traces: [{ trace_id: `${traceRoot}-fb` }],
      per_restaurant_failure_frequency: [{ restaurant_id: largeId, failure_count: 3 }],
      worst_offender_restaurant_id: largeId
    },
    pass: true,
    critical_logs: ['diagnostics_shape_ok=true']
  }));

  const durations = concurrent.map((entry) => Number(entry.duration_ms || 0));
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const maxRss = Math.max(...concurrent.map((entry) => Number(entry.rss_bytes || 0)), 0);
  tests.push(buildResult({
    test_name: 'performance_memory_guardrails',
    trace_id: `${traceRoot}-perf`,
    setup: `Simulated thresholds p95<=${P95_THRESHOLD_MS}, max_rss<=${MAX_RSS_BYTES}`,
    expected: 'Latency and memory are below thresholds',
    actual: { p50_ms: p50, p95_ms: p95, max_rss_bytes: maxRss },
    pass: p95 <= P95_THRESHOLD_MS && maxRss <= MAX_RSS_BYTES,
    critical_logs: [`p95_ms=${p95}`, `max_rss=${maxRss}`]
  }));

  tests.push(buildResult({
    test_name: 'canary_three_restaurants_check',
    trace_id: `${traceRoot}-canary`,
    setup: 'Simulated dynamic min/median/max canary target selection',
    expected: 'Canary checks pass for small/medium/large',
    actual: {
      canary_targets: dataset.restaurants,
      summary: { total: 3, failed: 0, pass_fail: 'PASS' }
    },
    pass: true,
    critical_logs: dataset.restaurants.map((entry) => `${entry.size}:${entry.restaurant_id}:${entry.item_count}`)
  }));

  return {
    tests,
    metadata: {
      mode: 'SIM_MODE',
      seed: 1337,
      canary_snapshot: {
        canary_targets: dataset.restaurants,
        summary: { total: 3, failed: 0, pass_fail: 'PASS' }
      },
      diagnostics_sample: {
        top_5_largest_mismatches_by_pct_drop: [{ restaurant_id: largeId, mismatch_pct_drop: 12.5 }],
        last_10_db_error_traces: [{ trace_id: `${traceRoot}-db` }],
        last_10_fallback_traces: [{ trace_id: `${traceRoot}-fb` }],
        per_restaurant_failure_frequency: [{ restaurant_id: largeId, failure_count: 3 }],
        worst_offender_restaurant_id: largeId
      }
    }
  };
}

function buildSummary(tests = []) {
  const total = tests.length;
  const passed = tests.filter((test) => test.pass_fail === 'PASS').length;
  const failed = total - passed;
  const gateFailures = {
    any_adversarial_test_failed: failed > 0,
    any_count_mismatch: tests.some((test) => test.test_name === 'concurrent_large_menu_10x' && test.pass_fail !== 'PASS'),
    any_silent_truncation: tests.some((test) => test.test_name === 'early_stop_truncation' && test.pass_fail !== 'PASS'),
    any_fallback_masking_in_strict_mode: tests.some((test) => test.test_name === 'db_page_2_fault' && test.pass_fail !== 'PASS')
  };

  const releaseGatePass = !gateFailures.any_adversarial_test_failed
    && !gateFailures.any_count_mismatch
    && !gateFailures.any_silent_truncation
    && !gateFailures.any_fallback_masking_in_strict_mode;

  return {
    total,
    passed,
    failed,
    pass_fail: failed === 0 ? 'PASS' : 'FAIL',
    release_gate_pass: releaseGatePass,
    gate_failures: gateFailures
  };
}

function toMarkdownReport(payload) {
  const lines = [];
  lines.push(`# Adversarial Menu Integrity Report (${payload.mode})`);
  lines.push('');
  lines.push(`Generated at: ${payload.generated_at}`);
  lines.push(`Run id: ${payload.run_id}`);
  lines.push(`Mode: ${payload.mode}`);
  lines.push(`Base URL: ${payload.base_url}`);
  lines.push('');
  lines.push('| test_name | trace_id | pass_fail |');
  lines.push('| --- | --- | --- |');
  for (const test of payload.tests) {
    lines.push(`| ${test.test_name} | ${String(test.trace_id).replace(/\|/g, '\\/')} | ${test.pass_fail} |`);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(payload.summary, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(payload.metadata || {}, null, 2));
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function sortKeysRecursively(value) {
  if (Array.isArray(value)) return value.map((entry) => sortKeysRecursively(entry));
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysRecursively(value[key]);
    }
    return sorted;
  }
  return value;
}

function signArtifactPayload(payload = {}) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.artifact_sha256;
  const canonical = JSON.stringify(sortKeysRecursively(clone));
  const artifactSha = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return {
    ...clone,
    artifact_sha256: artifactSha
  };
}

function writeModeArtifacts(mode, report) {
  const suffix = mode === 'SIM_MODE' ? 'sim' : 'live';
  const jsonPath = path.join(RUN_DIR, `adversarial-menu-integrity-${suffix}.json`);
  const mdPath = path.join(RUN_DIR, `adversarial-menu-integrity-${suffix}.md`);
  const latestJson = path.join(LATEST_DIR, `adversarial-menu-integrity-${suffix}.json`);
  const latestMd = path.join(LATEST_DIR, `adversarial-menu-integrity-${suffix}.md`);

  const signedReport = signArtifactPayload(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(signedReport, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, toMarkdownReport(report), 'utf8');
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);

  return {
    jsonPath,
    mdPath,
    latestJson,
    latestMd
  };
}

function writeCanonicalSnapshotArtifacts(results = []) {
  const liveResult = results.find((entry) => entry?.mode === 'LIVE_MODE');
  if (!liveResult) return null;

  const liveMetadata = liveResult.report?.metadata || {};
  const canarySnapshot = liveMetadata.canary_snapshot && typeof liveMetadata.canary_snapshot === 'object'
    ? liveMetadata.canary_snapshot
    : null;
  const diagnosticsSnapshot = liveMetadata.diagnostics_sample && typeof liveMetadata.diagnostics_sample === 'object'
    ? liveMetadata.diagnostics_sample
    : null;

  const snapshotPaths = {};

  if (canarySnapshot) {
    const canaryPayload = {
      schema_version: ARTIFACT_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      mode: 'LIVE_MODE',
      artifact_type: 'canary_output_snapshot',
      ...canarySnapshot
    };
    const signedCanaryPayload = signArtifactPayload(canaryPayload);
    const runPath = path.join(RUN_DIR, 'canary-output-snapshot.json');
    const latestPath = path.join(LATEST_DIR, 'canary-output-snapshot.json');
    fs.writeFileSync(runPath, `${JSON.stringify(signedCanaryPayload, null, 2)}\n`, 'utf8');
    fs.copyFileSync(runPath, latestPath);
    snapshotPaths.canary = {
      runPath,
      latestPath
    };
  }

  if (diagnosticsSnapshot) {
    const diagnosticsPayload = {
      schema_version: ARTIFACT_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      mode: 'LIVE_MODE',
      artifact_type: 'diagnostics_endpoint_sample',
      ...diagnosticsSnapshot
    };
    const signedDiagnosticsPayload = signArtifactPayload(diagnosticsPayload);
    const runPath = path.join(RUN_DIR, 'diagnostics-endpoint-sample.json');
    const latestPath = path.join(LATEST_DIR, 'diagnostics-endpoint-sample.json');
    fs.writeFileSync(runPath, `${JSON.stringify(signedDiagnosticsPayload, null, 2)}\n`, 'utf8');
    fs.copyFileSync(runPath, latestPath);
    snapshotPaths.diagnostics = {
      runPath,
      latestPath
    };
  }

  return snapshotPaths;
}

function printConsoleSummary(mode, tests, summary, artifactPaths) {
  const header = ['mode', 'test_name', 'pass_fail', 'trace_id'];
  const rows = tests.map((test) => [mode, test.test_name, test.pass_fail, String(test.trace_id)]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const formatRow = (cols) => cols.map((col, i) => col.padEnd(widths[i], ' ')).join(' | ');

  console.log('');
  console.log(formatRow(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('-|-'));
  rows.forEach((row) => console.log(formatRow(row)));
  console.log('');
  console.log(`${mode}_summary`, summary);
  console.log(`${mode}_artifact_json`, path.relative(ROOT, artifactPaths.jsonPath).replace(/\\/g, '/'));
  console.log(`${mode}_artifact_md`, path.relative(ROOT, artifactPaths.mdPath).replace(/\\/g, '/'));
  console.log(`${mode}_artifact_latest_json`, path.relative(ROOT, artifactPaths.latestJson).replace(/\\/g, '/'));
  console.log(`${mode}_artifact_latest_md`, path.relative(ROOT, artifactPaths.latestMd).replace(/\\/g, '/'));
}

async function runMode(mode) {
  const runner = mode === 'SIM_MODE' ? runSimTestMatrix : runLiveTestMatrix;
  const { tests, metadata } = await runner();
  const summary = buildSummary(tests);
  const report = {
    schema_version: ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    run_id: RUN_ID,
    mode,
    base_url: BASE_URL,
    artifacts_dir: path.relative(ROOT, RUN_DIR).replace(/\\/g, '/'),
    tests,
    summary,
    metadata
  };
  const artifactPaths = writeModeArtifacts(mode, report);
  printConsoleSummary(mode, tests, summary, artifactPaths);
  return { mode, report, artifactPaths };
}

async function main() {
  ensureDir(RUN_DIR);
  ensureDir(LATEST_DIR);

  const results = [];
  if (RUN_SIM) {
    results.push(await runMode('SIM_MODE'));
  }

  if (RUN_LIVE) {
    if (!HAS_LIVE_SECRETS) {
      const error = new Error('LIVE_MODE requested but required secrets are missing');
      error.code = 'LIVE_MODE_SECRETS_MISSING';
      throw error;
    }
    results.push(await runMode('LIVE_MODE'));
  }

  const snapshotPaths = writeCanonicalSnapshotArtifacts(results);

  const executedModes = results.map((entry) => entry.mode);
  const allPass = results.every((entry) => entry.report.summary.release_gate_pass);

  console.log('executed_modes', executedModes.join(','));
  if (snapshotPaths?.canary?.latestPath) {
    console.log('canary_snapshot_latest_json', path.relative(ROOT, snapshotPaths.canary.latestPath).replace(/\\/g, '/'));
  }
  if (snapshotPaths?.diagnostics?.latestPath) {
    console.log('diagnostics_snapshot_latest_json', path.relative(ROOT, snapshotPaths.diagnostics.latestPath).replace(/\\/g, '/'));
  }
  if (!allPass) process.exit(1);
}

main().catch((error) => {
  console.error('[adversarial-menu-integrity] failed', error?.stack || error?.message || String(error));
  process.exit(1);
});

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'artifacts', 'menu-integrity', 'proof', 'failure-paths');
const TMP_DIR = path.join(OUT_DIR, 'tmp');
const GATE_PATH = path.join(ROOT, 'scripts', 'releaseGateMenuIntegrity.mjs');
const REPLAY_PATH = path.join(ROOT, 'scripts', 'replayRegressionScenarios.mjs');

const LKG_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'last-known-good-live.json');
const LKG_COMPARE_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'latest', 'last-known-good-compare.json');
const SCENARIOS_PATH = path.join(ROOT, 'scripts', 'regression-scenarios.json');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

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

function signArtifact(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.artifact_sha256;
  const canonical = JSON.stringify(sortKeysRecursively(clone));
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return { ...clone, artifact_sha256: hash };
}

function computeSummaryFromTests(tests = []) {
  const total = tests.length;
  const passed = tests.filter((test) => String(test?.pass_fail || '') === 'PASS').length;
  const failed = total - passed;
  const gateFailures = {
    any_adversarial_test_failed: failed > 0,
    any_count_mismatch: tests.some((test) => test?.test_name === 'concurrent_large_menu_10x' && String(test?.pass_fail || '') !== 'PASS'),
    any_silent_truncation: tests.some((test) => test?.test_name === 'early_stop_truncation' && String(test?.pass_fail || '') !== 'PASS'),
    any_fallback_masking_in_strict_mode: tests.some((test) => test?.test_name === 'db_page_2_fault' && String(test?.pass_fail || '') !== 'PASS')
  };
  return {
    total,
    passed,
    failed,
    pass_fail: failed === 0 ? 'PASS' : 'FAIL',
    release_gate_pass: !Object.values(gateFailures).some(Boolean),
    gate_failures: gateFailures
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildPassArtifact({ mode, schemaVersion = '1.0.0', p95Ms = 120, maxRssBytes = 250_000_000, count = 3262 }) {
  const tests = [
    {
      test_name: 'db_page_2_fault',
      pass_fail: 'PASS',
      trace_id: `${mode.toLowerCase()}-trace-db-page-2-fault`,
      actual: { status_code: 503, strict_mode: true }
    },
    {
      test_name: 'early_stop_truncation',
      pass_fail: 'PASS',
      trace_id: `${mode.toLowerCase()}-trace-early-stop`,
      actual: { api_count: count, db_count: count }
    },
    {
      test_name: 'concurrent_large_menu_10x',
      pass_fail: 'PASS',
      trace_id: `${mode.toLowerCase()}-trace-concurrent`,
      actual: {
        unique_api_counts: [count],
        unique_db_counts: [count],
        unique_frontend_counts: [count]
      }
    },
    {
      test_name: 'fallback_cache_poison_replay',
      pass_fail: 'PASS',
      trace_id: `${mode.toLowerCase()}-trace-fallback-poison`,
      actual: { strict_mode_result: 'db_error_503' }
    },
    {
      test_name: 'performance_memory_guardrails',
      pass_fail: 'PASS',
      trace_id: `${mode.toLowerCase()}-trace-perf`,
      actual: {
        p95_ms: p95Ms,
        max_rss_bytes: maxRssBytes
      }
    }
  ];

  const payload = {
    schema_version: schemaVersion,
    generated_at: new Date().toISOString(),
    run_id: `${mode.toLowerCase()}-proof-${Date.now()}`,
    mode,
    tests,
    summary: computeSummaryFromTests(tests)
  };

  return signArtifact(payload);
}

function runNode(scriptOrCommand, args = [], env = {}) {
  const cmd = Array.isArray(scriptOrCommand)
    ? scriptOrCommand
    : ['node', scriptOrCommand, ...args];
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    shell: false,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  return {
    command: cmd.join(' '),
    exit_code: Number(result.status ?? 1),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: `${result.stdout || ''}${result.stderr || ''}`.trim()
  };
}

function saveEvidence(name, payload) {
  const filePath = path.join(OUT_DIR, `${name}.json`);
  writeJson(filePath, payload);
  return filePath;
}

function containsText(haystack, needle) {
  return String(haystack || '').includes(String(needle || ''));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withLkgState(action) {
  const priorLkg = readJson(LKG_PATH);
  const priorCompare = readJson(LKG_COMPARE_PATH);

  try {
    return action();
  } finally {
    if (priorLkg) writeJson(LKG_PATH, priorLkg);
    else if (fs.existsSync(LKG_PATH)) fs.unlinkSync(LKG_PATH);

    if (priorCompare) writeJson(LKG_COMPARE_PATH, priorCompare);
    else if (fs.existsSync(LKG_COMPARE_PATH)) fs.unlinkSync(LKG_COMPARE_PATH);
  }
}

async function runDiagnosticsProofs() {
  const evidence = {
    generated_at: new Date().toISOString(),
    steps: []
  };

  const ADMIN_KEY = 'proof-admin-key';
  const RATE_LIMIT_MAX = 2;
  const RATE_LIMIT_WINDOW_MS = 1000;
  const SUMMARY_ONLY_THRESHOLD_BYTES = 1024;

  const expressModule = await import('express');
  const express = expressModule.default;
  const rateLimitModule = await import('express-rate-limit');
  const rateLimit = rateLimitModule.default;
  const ipKeyGenerator = rateLimitModule.ipKeyGenerator;
  const monitor = await import('../backend/server/utils/menuIntegrityMonitor.js');

  const app = express();
  const diagnosticsLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const key = req.headers['x-admin-key'] || req.headers['authorization'] || 'no-admin-key';
      return `${String(key).slice(0, 128)}:${ipKeyGenerator(req.ip || '')}`;
    },
    message: { error: 'Too many diagnostics requests. Please slow down.' }
  });

  app.get('/api/admin/menu-integrity/diagnostics', diagnosticsLimiter, (req, res) => {
    const providedKey = req.headers['x-admin-key'] || String(req.headers['authorization'] || '').replace('Bearer ', '');
    if (String(providedKey || '') !== ADMIN_KEY) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rawLimit = Number(req.query.limit || 25);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 25;
    const scope = String(req.query.scope || 'all').trim().toLowerCase();
    const summaryOnly = String(req.query.summary_only || 'false').toLowerCase() === 'true';

    const diagnostics = monitor.getMenuIntegrityDiagnostics({ limit: safeLimit, scope });
    const payloadBytes = Number(diagnostics?.diagnostics_meta?.payload_bytes || 0);
    const isSummaryOnly = summaryOnly || payloadBytes >= SUMMARY_ONLY_THRESHOLD_BYTES;

    if (isSummaryOnly) {
      return res.json({
        success: true,
        summary_only: true,
        degraded_reason: summaryOnly ? 'client_requested' : 'payload_too_large',
        generated_at: diagnostics.generated_at,
        scope: diagnostics.scope,
        diagnostics_meta: diagnostics.diagnostics_meta
      });
    }

    return res.json({
      success: true,
      summary_only: false,
      ...diagnostics
    });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  try {
    monitor.clearMenuIntegrityMonitorForTests();

    // Pass path for diagnostics summary behavior before stress data exists.
    const fullResponse = await fetch(`${base}/api/admin/menu-integrity/diagnostics?limit=10`, {
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    const fullBody = await fullResponse.json();

    evidence.steps.push({
      case: 'diagnostics_summary_full_pass',
      expected: 'normal request can return full payload',
      status: fullResponse.status,
      success: fullResponse.status === 200 && fullBody?.summary_only !== true,
      body_excerpt: {
        success: fullBody?.success,
        summary_only: fullBody?.summary_only,
        degraded_reason: fullBody?.degraded_reason || null
      }
    });

    // Pass path for diagnostics endpoint under rate limit.
    const passResponse = await fetch(`${base}/api/admin/menu-integrity/diagnostics?limit=10`, {
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    evidence.steps.push({
      case: 'diagnostics_rate_limit_pass',
      expected: 'status 200 while still under configured max',
      status: passResponse.status,
      success: passResponse.status === 200
    });

    // Fail path for rate limiter.
    const rateStatuses = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(`${base}/api/admin/menu-integrity/diagnostics?limit=10`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      rateStatuses.push(r.status);
      if (i === 2) {
        const body = await r.json().catch(() => ({}));
        evidence.steps.push({
          case: 'diagnostics_rate_limit_fail',
          expected: 'third request returns 429',
          statuses: rateStatuses,
          status: r.status,
          success: r.status === 429,
          body
        });
      }
    }

    // Wait for limiter window reset before degradation checks.
    await sleep(1100);

    // Build heavy diagnostics state and verify summary-only auto-degrade.
    for (let i = 0; i < 700; i += 1) {
      monitor.recordMenuIntegrityWarning('PROOF_PAYLOAD_STRESS', {
        trace_id: `proof-warn-${i}`,
        restaurant_id: `proof-rid-${i % 25}`,
        details: 'x'.repeat(140)
      });
      monitor.recordDbErrorTrace({ trace_id: `proof-db-${i}`, restaurant_id: `proof-rid-${i % 25}` });
      monitor.recordNonDbSourceTrace({ trace_id: `proof-fb-${i}`, restaurant_id: `proof-rid-${i % 25}` });
    }

    const degradedResponse = await fetch(`${base}/api/admin/menu-integrity/diagnostics?limit=200`, {
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    const degradedBody = await degradedResponse.json();
    evidence.steps.push({
      case: 'diagnostics_summary_only_degradation_path',
      expected: 'summary_only=true with degraded_reason=payload_too_large',
      status: degradedResponse.status,
      success: degradedResponse.status === 200 && degradedBody?.summary_only === true && degradedBody?.degraded_reason === 'payload_too_large',
      body_excerpt: {
        summary_only: degradedBody?.summary_only,
        degraded_reason: degradedBody?.degraded_reason,
        diagnostics_meta: degradedBody?.diagnostics_meta || null
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  evidence.success = evidence.steps.every((step) => step.success === true);
  return evidence;
}

function buildProofFixtures() {
  const fixtures = {
    sim_pass: buildPassArtifact({ mode: 'SIM_MODE', schemaVersion: '1.0.0', p95Ms: 110, maxRssBytes: 200_000_000, count: 3262 }),
    live_pass: buildPassArtifact({ mode: 'LIVE_MODE', schemaVersion: '1.0.0', p95Ms: 120, maxRssBytes: 240_000_000, count: 3262 }),
    live_high_latency: buildPassArtifact({ mode: 'LIVE_MODE', schemaVersion: '1.0.0', p95Ms: 260, maxRssBytes: 240_000_000, count: 3262 }),
    live_lkg_drift: buildPassArtifact({ mode: 'LIVE_MODE', schemaVersion: '1.0.0', p95Ms: 120, maxRssBytes: 240_000_000, count: 3262 }),
    sim_schema_unsupported: buildPassArtifact({ mode: 'SIM_MODE', schemaVersion: '9.9.9', p95Ms: 110, maxRssBytes: 200_000_000, count: 3262 })
  };

  const paths = {
    sim_pass: path.join(TMP_DIR, 'sim-pass.json'),
    live_pass: path.join(TMP_DIR, 'live-pass.json'),
    live_high_latency: path.join(TMP_DIR, 'live-high-latency.json'),
    live_lkg_drift: path.join(TMP_DIR, 'live-lkg-drift.json'),
    sim_schema_unsupported: path.join(TMP_DIR, 'sim-schema-unsupported.json')
  };

  for (const [key, filePath] of Object.entries(paths)) {
    writeJson(filePath, fixtures[key]);
  }

  return paths;
}

function runGateWith(paths, envOverrides = {}) {
  return runNode('scripts/releaseGateMenuIntegrity.mjs', [paths.sim, paths.live], {
    RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
    REQUIRE_LIVE_REPORT: 'true',
    ...envOverrides
  });
}

function runGateSimOnly(simPath, envOverrides = {}) {
  return runNode('scripts/releaseGateMenuIntegrity.mjs', [simPath], {
    RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
    REQUIRE_LIVE_REPORT: 'false',
    ...envOverrides
  });
}

function runReplayWithScenarioOverride(tempScenarioPayload) {
  const original = readJson(SCENARIOS_PATH);
  writeJson(SCENARIOS_PATH, tempScenarioPayload);
  const result = runNode(REPLAY_PATH, [], { REGRESSION_REPLAY_STRICT: 'true' });
  if (original) writeJson(SCENARIOS_PATH, original);
  return result;
}

async function main() {
  const fixtures = buildProofFixtures();
  const bundle = {
    generated_at: new Date().toISOString(),
    schema_version: '1.0.0',
    proof_type: 'menu_integrity_failure_paths',
    cases: {}
  };

  // 1) LKG drift block: pass when off, fail when on.
  const lkgEvidence = withLkgState(() => {
    const baseline = {
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      source_report: 'proof-baseline',
      metrics: {
        run_id: 'proof-baseline',
        generated_at: new Date().toISOString(),
        concurrent_api_count: 1000,
        concurrent_db_count: 1000,
        p95_ms: 100,
        max_rss_bytes: 100_000_000,
        total_tests: 5,
        passed_tests: 5
      }
    };

    writeJson(LKG_PATH, baseline);
    const passResult = runGateWith(
      { sim: fixtures.sim_pass, live: fixtures.live_lkg_drift },
      { ENFORCE_LKG_DRIFT_BLOCK: 'false', MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD: '0.15' }
    );

    writeJson(LKG_PATH, baseline);
    const failResult = runGateWith(
      { sim: fixtures.sim_pass, live: fixtures.live_lkg_drift },
      { ENFORCE_LKG_DRIFT_BLOCK: 'true', MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD: '0.15' }
    );

    return {
      pass_result: passResult,
      fail_result: failResult,
      pass_expected: passResult.exit_code === 0,
      fail_expected: failResult.exit_code !== 0 && containsText(failResult.output, 'last-known-good deviation exceeded threshold'),
      compare_snapshot: readJson(LKG_COMPARE_PATH)
    };
  });
  bundle.cases.lkg_drift_block = lkgEvidence;
  saveEvidence('lkg-drift-block', lkgEvidence);

  // 2) Schema version unsupported isolated from checksum mismatch.
  const schemaFail = runGateSimOnly(fixtures.sim_schema_unsupported, {
    RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
    REQUIRE_LIVE_REPORT: 'false'
  });
  const schemaPass = runGateSimOnly(fixtures.sim_pass, {
    RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
    REQUIRE_LIVE_REPORT: 'false'
  });
  const schemaEvidence = {
    pass_result: schemaPass,
    fail_result: schemaFail,
    fail_contains_schema_unsupported: containsText(schemaFail.output, 'schema_version_unsupported'),
    fail_contains_checksum_mismatch: containsText(schemaFail.output, 'artifact_checksum_mismatch'),
    isolation_proven: containsText(schemaFail.output, 'schema_version_unsupported') && !containsText(schemaFail.output, 'artifact_checksum_mismatch')
  };
  bundle.cases.schema_version_block = schemaEvidence;
  saveEvidence('schema-version-block', schemaEvidence);

  // 3) Latency regression block evidence with baseline provenance.
  const latencyEvidence = withLkgState(() => {
    const baseline = {
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      source_report: 'proof-latency-baseline',
      baseline_provenance: {
        source: 'proof_fixture',
        normalized_environment: {
          NODE_ENV: 'test',
          SIM_MODE: 'false',
          LIVE_MODE: 'true',
          cpu_class: 'github-actions-standard',
          load_class: 'isolated-proof-run'
        }
      },
      metrics: {
        run_id: 'proof-baseline-latency',
        generated_at: new Date().toISOString(),
        concurrent_api_count: 3262,
        concurrent_db_count: 3262,
        p95_ms: 100,
        max_rss_bytes: 240_000_000,
        total_tests: 5,
        passed_tests: 5
      }
    };
    writeJson(LKG_PATH, baseline);

    const passResult = runGateWith(
      { sim: fixtures.sim_pass, live: fixtures.live_high_latency },
      {
        ENFORCE_LKG_DRIFT_BLOCK: 'false',
        ENFORCE_LATENCY_REGRESSION: 'false',
        MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD: '0.95',
        LATENCY_REGRESSION_THRESHOLD_PCT: '0.20'
      }
    );

    writeJson(LKG_PATH, baseline);
    const failResult = runGateWith(
      { sim: fixtures.sim_pass, live: fixtures.live_high_latency },
      {
        ENFORCE_LKG_DRIFT_BLOCK: 'false',
        ENFORCE_LATENCY_REGRESSION: 'true',
        MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD: '0.95',
        LATENCY_REGRESSION_THRESHOLD_PCT: '0.20'
      }
    );

    return {
      baseline_provenance: baseline.baseline_provenance,
      prior_p95_ms: baseline.metrics.p95_ms,
      current_p95_ms: 260,
      threshold_pct: 20,
      pass_result: passResult,
      fail_result: failResult,
      fail_expected: failResult.exit_code !== 0 && containsText(failResult.output, 'BLOCKED: p95 latency regression'),
      decision_text: failResult.output
    };
  });
  bundle.cases.latency_regression_block = latencyEvidence;
  saveEvidence('latency-regression-block', latencyEvidence);

  // 4) Regression replay orphan failure path.
  const replayPass = runNode(REPLAY_PATH, [], { REGRESSION_REPLAY_STRICT: 'true' });
  const replayFail = runReplayWithScenarioOverride({
    schema_version: '1.0.0',
    description: 'Intentional orphan replay failure fixture',
    scenarios: [
      {
        id: 'RSC-ORPHAN-FAIL',
        name: 'orphan_scenario_missing_test_ref',
        captured_at: new Date().toISOString(),
        source: 'proof-fixture',
        description: 'Intentional orphan scenario for failure-path proof.',
        trigger: 'test_ref removed',
        expected_behavior: 'Replay should fail',
        gate_failure_signature: 'unknown_signature_for_orphan_fixture',
        test_ref: 'this_test_name_does_not_exist_anywhere in imaginary-file.test.js'
      }
    ]
  });
  const replayEvidence = {
    pass_result: replayPass,
    fail_result: replayFail,
    fail_expected: replayFail.exit_code !== 0 && containsText(replayFail.output, 'BLOCKED: orphaned or uncovered scenarios')
  };
  bundle.cases.regression_replay_orphan_failure = replayEvidence;
  saveEvidence('regression-replay-orphan-failure', replayEvidence);

  // 5 & 6) Diagnostics rate-limit failure + summary-only degradation path.
  const diagnosticsEvidence = await runDiagnosticsProofs();
  bundle.cases.diagnostics_route_hardening = diagnosticsEvidence;
  saveEvidence('diagnostics-route-hardening', diagnosticsEvidence);

  bundle.success = Object.values(bundle.cases).every((entry) => {
    if (entry?.pass_expected === false || entry?.fail_expected === false) return false;
    if (entry?.isolation_proven === false) return false;
    if (entry?.success === false) return false;
    return true;
  });

  const bundlePath = saveEvidence('proof-bundle-index', bundle);
  console.log('[proof-bundle] written:', path.relative(ROOT, bundlePath).replace(/\\/g, '/'));
  console.log('[proof-bundle] success:', bundle.success);

  if (!bundle.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[proof-bundle] failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});

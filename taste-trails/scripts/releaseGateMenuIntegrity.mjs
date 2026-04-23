#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const defaultSimPath = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'latest', 'adversarial-menu-integrity-sim.json');
const defaultLivePath = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'latest', 'adversarial-menu-integrity-live.json');

const explicitPaths = process.argv.slice(2).map((entry) => path.resolve(entry));
const requireLiveReport = String(process.env.REQUIRE_LIVE_REPORT || '').toLowerCase() === 'true';
const enforceUnitTests = String(process.env.RELEASE_GATE_ENFORCE_UNIT_TESTS || 'true').toLowerCase() !== 'false';
const lkgDeviationThreshold = Number.isFinite(Number(process.env.MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD))
  ? Math.max(0.01, Math.min(0.95, Number(process.env.MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD)))
  : 0.15;
const enforceLkgDriftBlock = String(process.env.ENFORCE_LKG_DRIFT_BLOCK || 'false').toLowerCase() === 'true';
const enforceLatencyRegression = String(process.env.ENFORCE_LATENCY_REGRESSION || 'false').toLowerCase() === 'true';
const latencyRegressionThreshold = Number.isFinite(Number(process.env.LATENCY_REGRESSION_THRESHOLD_PCT))
  ? Math.max(0.01, Math.min(5.0, Number(process.env.LATENCY_REGRESSION_THRESHOLD_PCT)))
  : 0.20;
// Schema version compatibility: versions we can read. Update this list when adding breaking schema changes.
const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.1.0', '1.2.0'];
const SCHEMA_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const LKG_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'last-known-good-live.json');
const LKG_COMPARE_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'latest', 'last-known-good-compare.json');

const reportPaths = explicitPaths.length > 0
  ? explicitPaths
  : [defaultSimPath, defaultLivePath].filter((candidate, index) => {
      if (index === 0) return true;
      return fs.existsSync(candidate);
    });

if (reportPaths.length === 0) {
  console.error('[release-gate] missing reports: no report paths were provided or discovered');
  process.exit(1);
}

function runUnitTestsOrFail() {
  if (!enforceUnitTests) return;
  const result = spawnSync('npm test', [], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env }
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      console.error('[release-gate] unit_test_spawn_error:', result.error.message);
    }
    if (result.signal) {
      console.error('[release-gate] unit_test_signal:', result.signal);
    }
    console.error('[release-gate] BLOCKED: unit_tests_failed');
    process.exit(1);
  }
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

function canonicalSha256(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  delete clone.artifact_sha256;
  const canonical = JSON.stringify(sortKeysRecursively(clone));
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function validateReportTopLevel(payload, mode, failures) {
  const schemaVersion = String(payload?.schema_version || '').trim();
  if (!schemaVersion) {
    failures.push(`${mode}:schema_version_missing`);
  } else if (!SCHEMA_VERSION_PATTERN.test(schemaVersion)) {
    failures.push(`${mode}:schema_version_invalid_format`);
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    failures.push(`${mode}:schema_version_unsupported:${schemaVersion}:supported=${SUPPORTED_SCHEMA_VERSIONS.join('|')}`);
  }
  if (!String(payload?.artifact_sha256 || '').trim()) failures.push(`${mode}:artifact_sha256_missing`);
  if (!payload?.generated_at) failures.push(`${mode}:generated_at_missing`);
  if (!String(payload?.mode || '').trim()) failures.push(`${mode}:mode_missing`);
  if (!Array.isArray(payload?.tests)) failures.push(`${mode}:tests_array_missing`);
}

function validateArtifactChecksum(payload, mode, failures) {
  const expected = String(payload?.artifact_sha256 || '').trim();
  if (!expected) return;
  const actual = canonicalSha256(payload);
  if (expected !== actual) {
    failures.push(`${mode}:artifact_checksum_mismatch`);
  }
}

function validateTraceIds(payload, mode, failures) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  for (const test of tests) {
    if (!String(test?.trace_id || '').trim()) {
      failures.push(`${mode}:missing_trace_id:${String(test?.test_name || 'unknown_test')}`);
    }
  }
}

function validateConcurrentCountParity(payload, mode, failures) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const concurrent = tests.find((entry) => entry?.test_name === 'concurrent_large_menu_10x');
  if (!concurrent) {
    failures.push(`${mode}:concurrent_large_menu_10x_missing`);
    return;
  }

  const actual = concurrent.actual || {};
  const api = actual.unique_api_counts || actual.apiCounts || [];
  const db = actual.unique_db_counts || actual.dbCounts || [];
  const frontend = actual.unique_frontend_counts || actual.frontendCounts || [];

  const apiVal = Array.isArray(api) ? api[0] : Number(api);
  const dbVal = Array.isArray(db) ? db[0] : Number(db);
  const frontendVal = Array.isArray(frontend) ? frontend[0] : Number(frontend);

  if (!Number.isFinite(Number(apiVal)) || !Number.isFinite(Number(dbVal)) || !Number.isFinite(Number(frontendVal))) {
    failures.push(`${mode}:concurrent_counts_missing_or_non_numeric`);
    return;
  }

  if (Number(apiVal) !== Number(dbVal) || Number(apiVal) !== Number(frontendVal)) {
    failures.push(`${mode}:concurrent_count_parity_broken`);
  }
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

function validateSummaryConsistency(payload, mode, failures) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const summary = payload?.summary || {};
  const derived = computeSummaryFromTests(tests);

  if (Number(summary.total) !== derived.total) failures.push(`${mode}:summary_total_mismatch`);
  if (Number(summary.passed) !== derived.passed) failures.push(`${mode}:summary_passed_mismatch`);
  if (Number(summary.failed) !== derived.failed) failures.push(`${mode}:summary_failed_mismatch`);
  if (String(summary.pass_fail || '') !== derived.pass_fail) failures.push(`${mode}:summary_pass_fail_mismatch`);

  const gate = summary.gate_failures || {};
  if (Boolean(gate.any_adversarial_test_failed) !== Boolean(derived.gate_failures.any_adversarial_test_failed)) {
    failures.push(`${mode}:summary_gate_any_adversarial_test_failed_mismatch`);
  }
  if (Boolean(gate.any_count_mismatch) !== Boolean(derived.gate_failures.any_count_mismatch)) {
    failures.push(`${mode}:summary_gate_any_count_mismatch_mismatch`);
  }
  if (Boolean(gate.any_silent_truncation) !== Boolean(derived.gate_failures.any_silent_truncation)) {
    failures.push(`${mode}:summary_gate_any_silent_truncation_mismatch`);
  }
  if (Boolean(gate.any_fallback_masking_in_strict_mode) !== Boolean(derived.gate_failures.any_fallback_masking_in_strict_mode)) {
    failures.push(`${mode}:summary_gate_any_fallback_masking_mismatch`);
  }

  if (Boolean(summary.release_gate_pass) !== Boolean(derived.release_gate_pass)) {
    failures.push(`${mode}:summary_release_gate_pass_mismatch`);
  }
}

function validateSimCoverage(payload, failures) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const requiredSimTests = [
    'db_page_2_fault',
    'early_stop_truncation',
    'concurrent_large_menu_10x',
    'fallback_cache_poison_replay'
  ];

  for (const testName of requiredSimTests) {
    const match = tests.find((entry) => entry?.test_name === testName);
    if (!match) {
      failures.push(`SIM_MODE:${testName}:missing`);
      continue;
    }
    if (String(match.pass_fail || '') !== 'PASS') {
      failures.push(`SIM_MODE:${testName}:not_pass`);
    }
  }
}

function safeJsonRead(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function findTest(payload, name) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  return tests.find((entry) => entry?.test_name === name) || null;
}

function extractLiveMetrics(payload) {
  const concurrent = findTest(payload, 'concurrent_large_menu_10x');
  const performance = findTest(payload, 'performance_memory_guardrails');
  const actual = concurrent?.actual || {};
  const apiValues = Array.isArray(actual.unique_api_counts) ? actual.unique_api_counts : actual.apiCounts;
  const dbValues = Array.isArray(actual.unique_db_counts) ? actual.unique_db_counts : actual.dbCounts;

  const concurrentApiCount = Number(Array.isArray(apiValues) ? apiValues[0] : apiValues || 0);
  const concurrentDbCount = Number(Array.isArray(dbValues) ? dbValues[0] : dbValues || 0);

  return {
    run_id: payload?.run_id || null,
    generated_at: payload?.generated_at || null,
    environment_fingerprint: {
      node_env: String(process.env.NODE_ENV || 'unknown').toLowerCase(),
      sim_mode: String(process.env.SIM_MODE || '').toLowerCase(),
      live_mode: String(process.env.LIVE_MODE || '').toLowerCase(),
      perf_env_class: String(process.env.MENU_INTEGRITY_PERF_ENV_CLASS || 'default').toLowerCase()
    },
    concurrent_api_count: Number.isFinite(concurrentApiCount) ? concurrentApiCount : 0,
    concurrent_db_count: Number.isFinite(concurrentDbCount) ? concurrentDbCount : 0,
    p95_ms: Number(performance?.actual?.p95_ms || 0),
    max_rss_bytes: Number(performance?.actual?.max_rss_bytes || 0),
    total_tests: Number(payload?.summary?.total || 0),
    passed_tests: Number(payload?.summary?.passed || 0)
  };
}

function computeDeviation(current = 0, baseline = 0) {
  const curr = Number(current || 0);
  const base = Number(baseline || 0);
  if (!Number.isFinite(curr) || !Number.isFinite(base)) return 0;
  if (base === 0) return curr === 0 ? 0 : 1;
  return Math.abs(curr - base) / Math.abs(base);
}

function recordLastKnownGoodComparison(livePayload) {
  const current = extractLiveMetrics(livePayload);
  const previous = safeJsonRead(LKG_PATH);
  const previousMetrics = previous?.metrics || null;

  const compare = {
    generated_at: new Date().toISOString(),
    threshold: lkgDeviationThreshold,
    previous_metrics: previousMetrics,
    current_metrics: current,
    environment_normalization: {
      baseline_fingerprint: previousMetrics?.environment_fingerprint || null,
      current_fingerprint: current.environment_fingerprint,
      matched: true,
      mismatch_fields: []
    },
    deviations: previousMetrics ? {
      concurrent_api_count_pct: computeDeviation(current.concurrent_api_count, previousMetrics.concurrent_api_count),
      concurrent_db_count_pct: computeDeviation(current.concurrent_db_count, previousMetrics.concurrent_db_count),
      p95_ms_pct: computeDeviation(current.p95_ms, previousMetrics.p95_ms),
      max_rss_bytes_pct: computeDeviation(current.max_rss_bytes, previousMetrics.max_rss_bytes)
    } : null,
    alert: false,
    alert_reasons: []
  };

  if (previousMetrics?.environment_fingerprint) {
    for (const key of Object.keys(current.environment_fingerprint || {})) {
      const curr = String(current.environment_fingerprint?.[key] || '');
      const base = String(previousMetrics.environment_fingerprint?.[key] || '');
      if (curr !== base) {
        compare.environment_normalization.matched = false;
        compare.environment_normalization.mismatch_fields.push(key);
      }
    }
  }

  if (compare.deviations) {
    for (const [metric, value] of Object.entries(compare.deviations)) {
      if (Number(value) > lkgDeviationThreshold) {
        compare.alert = true;
        compare.alert_reasons.push(`${metric}_deviation_exceeds_threshold`);
      }
    }
  }

  writeJson(LKG_COMPARE_PATH, compare);
  if (compare.alert) {
    if (enforceLkgDriftBlock) {
      console.error('[release-gate] BLOCKED: last-known-good deviation exceeded threshold:', compare.alert_reasons.join(', '));
      console.error('[release-gate] Set ENFORCE_LKG_DRIFT_BLOCK=false or raise MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD to allow.');
      process.exit(1);
    }
    console.warn('[release-gate] ALERT: last-known-good deviation detected:', compare.alert_reasons.join(', '));
    console.warn('[release-gate] Enable ENFORCE_LKG_DRIFT_BLOCK=true to make this a hard gate failure.');
  }

  const snapshot = {
    schema_version: String(livePayload?.schema_version || '1.0.0'),
    generated_at: new Date().toISOString(),
    source_report: reportPaths.find((entry) => entry.includes('adversarial-menu-integrity-live.json')) || null,
    metrics: current
  };
  writeJson(LKG_PATH, snapshot);

  // Latency regression guard (optional hard gate).
  if (enforceLatencyRegression && previousMetrics && Number(previousMetrics.p95_ms) > 0) {
    if (!compare.environment_normalization.matched) {
      console.error(
        '[release-gate] BLOCKED: latency regression guard requires normalized environment; mismatch fields:',
        compare.environment_normalization.mismatch_fields.join(', ')
      );
      console.error('[release-gate] Set MENU_INTEGRITY_PERF_ENV_CLASS consistently across baseline and current runs.');
      process.exit(1);
    }
    const latencyDev = computeDeviation(current.p95_ms, previousMetrics.p95_ms);
    if (latencyDev > latencyRegressionThreshold) {
      console.error(
        `[release-gate] BLOCKED: p95 latency regression: current=${current.p95_ms}ms baseline=${previousMetrics.p95_ms}ms deviation=${(latencyDev * 100).toFixed(1)}% threshold=${(latencyRegressionThreshold * 100).toFixed(1)}%`
      );
      console.error('[release-gate] Set ENFORCE_LATENCY_REGRESSION=false or raise LATENCY_REGRESSION_THRESHOLD_PCT to allow.');
      process.exit(1);
    }
  }
}

runUnitTestsOrFail();

const failures = [];
let sawSimMode = false;
let sawLiveMode = false;
const parsedByMode = new Map();

for (const reportPath of reportPaths) {
  if (!fs.existsSync(reportPath)) {
    failures.push(`missing_report:${path.relative(ROOT, reportPath).replace(/\\/g, '/')}`);
    continue;
  }

  let payload = null;
  try {
    payload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    failures.push(`invalid_json:${path.relative(ROOT, reportPath).replace(/\\/g, '/')}`);
    continue;
  }

  const summary = payload?.summary || {};
  const mode = String(payload?.mode || '').trim() || 'UNKNOWN_MODE';
  parsedByMode.set(mode, payload);

  if (mode === 'SIM_MODE') sawSimMode = true;
  if (mode === 'LIVE_MODE') sawLiveMode = true;

  validateReportTopLevel(payload, mode, failures);
  validateArtifactChecksum(payload, mode, failures);
  validateTraceIds(payload, mode, failures);
  validateConcurrentCountParity(payload, mode, failures);
  validateSummaryConsistency(payload, mode, failures);

  if (summary.pass_fail !== 'PASS') {
    failures.push(`${mode}:suite_pass_fail_not_pass`);
  }
  if (summary.gate_failures?.any_adversarial_test_failed) {
    failures.push(`${mode}:any_adversarial_test_failed`);
  }
  if (summary.gate_failures?.any_count_mismatch) {
    failures.push(`${mode}:any_count_mismatch_exists`);
  }
  if (summary.gate_failures?.any_silent_truncation) {
    failures.push(`${mode}:silent_truncation_detected`);
  }
  if (summary.gate_failures?.any_fallback_masking_in_strict_mode) {
    failures.push(`${mode}:fallback_masking_in_strict_mode_detected`);
  }
}

if (parsedByMode.has('SIM_MODE')) {
  validateSimCoverage(parsedByMode.get('SIM_MODE'), failures);
}

if (!sawSimMode) {
  failures.push('SIM_MODE_report_missing');
}
if (requireLiveReport && !sawLiveMode) {
  failures.push('LIVE_MODE_report_required_but_missing');
}

if (failures.length > 0) {
  console.error('[release-gate] BLOCKED:', failures.join(', '));
  process.exit(1);
}

if (parsedByMode.has('LIVE_MODE')) {
  recordLastKnownGoodComparison(parsedByMode.get('LIVE_MODE'));
}

console.log('[release-gate] PASS');
for (const reportPath of reportPaths) {
  if (fs.existsSync(reportPath)) {
    console.log('[release-gate] report:', path.relative(ROOT, reportPath).replace(/\\/g, '/'));
  }
}

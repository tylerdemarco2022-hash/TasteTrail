#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'artifacts', 'menu-integrity', 'proof', 'failure-paths');
const TMP_DIR = path.join(OUT_DIR, 'tmp-ci-failures');
const LKG_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'last-known-good-live.json');
const LKG_COMPARE_PATH = path.join(ROOT, 'artifacts', 'menu-integrity', 'adversarial', 'latest', 'last-known-good-compare.json');
const SCENARIOS_PATH = path.join(ROOT, 'scripts', 'regression-scenarios.json');

const mode = String(process.argv[2] || '').trim();
const logPathArg = String(process.argv[3] || '').trim();

if (!mode || !logPathArg) {
  console.error('Usage: node scripts/runCiFailureSimulation.mjs <mode> <logPath>');
  process.exit(2);
}

fs.mkdirSync(path.dirname(logPathArg), { recursive: true });
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

function canonicalSha256(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  delete clone.artifact_sha256;
  return crypto.createHash('sha256').update(JSON.stringify(sortKeysRecursively(clone)), 'utf8').digest('hex');
}

function sign(payload) {
  return {
    ...payload,
    artifact_sha256: canonicalSha256(payload)
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

function runNode(args, env = {}) {
  const result = spawnSync('node', args, {
    cwd: ROOT,
    shell: false,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  return {
    command: `node ${args.join(' ')}`,
    exit_code: Number(result.status ?? 1),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: `${result.stdout || ''}${result.stderr || ''}`.trim()
  };
}

function blockedReasonFromOutput(output, fallback) {
  const line = String(output || '').split(/\r?\n/).find((v) => v.includes('BLOCKED'));
  return line ? line.trim() : fallback;
}

function buildPassArtifact({ modeName, schemaVersion = '1.0.0', p95Ms = 120, maxRssBytes = 240_000_000, count = 3262 }) {
  return sign({
    schema_version: schemaVersion,
    generated_at: new Date().toISOString(),
    run_id: `ci-failure-${modeName}-${Date.now()}`,
    mode: modeName,
    tests: [
      { test_name: 'db_page_2_fault', pass_fail: 'PASS', trace_id: `${modeName}-trace-1`, actual: { status_code: 503 } },
      { test_name: 'early_stop_truncation', pass_fail: 'PASS', trace_id: `${modeName}-trace-2`, actual: { api_count: count, db_count: count } },
      { test_name: 'concurrent_large_menu_10x', pass_fail: 'PASS', trace_id: `${modeName}-trace-3`, actual: { unique_api_counts: [count], unique_db_counts: [count], unique_frontend_counts: [count] } },
      { test_name: 'fallback_cache_poison_replay', pass_fail: 'PASS', trace_id: `${modeName}-trace-4`, actual: { strict_mode_result: 'db_error_503' } },
      { test_name: 'performance_memory_guardrails', pass_fail: 'PASS', trace_id: `${modeName}-trace-5`, actual: { p95_ms: p95Ms, max_rss_bytes: maxRssBytes } }
    ],
    summary: {
      total: 5,
      passed: 5,
      failed: 0,
      pass_fail: 'PASS',
      release_gate_pass: true,
      gate_failures: {
        any_adversarial_test_failed: false,
        any_count_mismatch: false,
        any_silent_truncation: false,
        any_fallback_masking_in_strict_mode: false
      }
    }
  });
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

function simulateLkgDrift() {
  const simPath = path.join(TMP_DIR, 'sim-lkg-pass.json');
  const livePath = path.join(TMP_DIR, 'live-lkg-drift.json');
  writeJson(simPath, buildPassArtifact({ modeName: 'SIM_MODE' }));
  writeJson(livePath, buildPassArtifact({ modeName: 'LIVE_MODE', p95Ms: 120, maxRssBytes: 240_000_000, count: 3262 }));

  return withLkgState(() => {
    writeJson(LKG_PATH, {
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      source_report: 'ci-lkg-baseline',
      metrics: {
        run_id: 'ci-lkg-baseline',
        generated_at: new Date().toISOString(),
        concurrent_api_count: 1000,
        concurrent_db_count: 1000,
        p95_ms: 100,
        max_rss_bytes: 100000000,
        total_tests: 5,
        passed_tests: 5
      }
    });

    const result = runNode(
      ['scripts/releaseGateMenuIntegrity.mjs', simPath, livePath],
      {
        RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
        REQUIRE_LIVE_REPORT: 'true',
        ENFORCE_LKG_DRIFT_BLOCK: 'true',
        MENU_INTEGRITY_LKG_DEVIATION_THRESHOLD: '0.15'
      }
    );

    return {
      guarantee_name: 'lkg_drift_block',
      trigger_used: 'ENFORCE_LKG_DRIFT_BLOCK=true with high deviation from baseline',
      blocked_reason: blockedReasonFromOutput(result.output, 'BLOCKED: lkg drift'),
      exit_code: result.exit_code,
      raw: result
    };
  });
}

function simulateSchemaFailure() {
  const simPath = path.join(TMP_DIR, 'sim-schema-unsupported.json');
  writeJson(simPath, buildPassArtifact({ modeName: 'SIM_MODE', schemaVersion: '9.9.9' }));

  const result = runNode(
    ['scripts/releaseGateMenuIntegrity.mjs', simPath],
    {
      RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
      REQUIRE_LIVE_REPORT: 'false'
    }
  );

  return {
    guarantee_name: 'schema_version_block',
    trigger_used: 'unsupported schema_version=9.9.9',
    blocked_reason: blockedReasonFromOutput(result.output, 'BLOCKED: schema version'),
    exit_code: result.exit_code,
    raw: result
  };
}

function simulateLatencyFailure() {
  const simPath = path.join(TMP_DIR, 'sim-latency-pass.json');
  const livePath = path.join(TMP_DIR, 'live-latency-high.json');
  writeJson(simPath, buildPassArtifact({ modeName: 'SIM_MODE' }));
  writeJson(livePath, buildPassArtifact({ modeName: 'LIVE_MODE', p95Ms: 260 }));

  return withLkgState(() => {
    writeJson(LKG_PATH, {
      schema_version: '1.0.0',
      generated_at: new Date().toISOString(),
      source_report: 'ci-latency-baseline',
      metrics: {
        run_id: 'ci-latency-baseline',
        generated_at: new Date().toISOString(),
        concurrent_api_count: 3262,
        concurrent_db_count: 3262,
        p95_ms: 100,
        max_rss_bytes: 240000000,
        total_tests: 5,
        passed_tests: 5
      }
    });

    const result = runNode(
      ['scripts/releaseGateMenuIntegrity.mjs', simPath, livePath],
      {
        RELEASE_GATE_ENFORCE_UNIT_TESTS: 'false',
        REQUIRE_LIVE_REPORT: 'true',
        ENFORCE_LKG_DRIFT_BLOCK: 'false',
        ENFORCE_LATENCY_REGRESSION: 'true',
        LATENCY_REGRESSION_THRESHOLD_PCT: '0.20'
      }
    );

    return {
      guarantee_name: 'latency_regression_block',
      trigger_used: 'ENFORCE_LATENCY_REGRESSION=true with p95 260 vs baseline 100',
      blocked_reason: blockedReasonFromOutput(result.output, 'BLOCKED: latency regression'),
      exit_code: result.exit_code,
      raw: result
    };
  });
}

function simulateReplayFailure() {
  const original = readJson(SCENARIOS_PATH);
  const tampered = {
    schema_version: '1.0.0',
    description: 'CI replay orphan fail simulation',
    scenarios: [
      {
        id: 'RSC-CI-ORPHAN',
        name: 'ci_orphan_scenario',
        captured_at: new Date().toISOString(),
        source: 'ci-adversarial',
        description: 'Intentional orphan by unknown gate signature',
        trigger: 'unknown gate signature',
        expected_behavior: 'Replay fails',
        gate_failure_signature: 'unknown_signature_for_ci_orphan',
        test_ref: 'early_stop_truncation in runAdversarialMenuIntegrity.mjs'
      }
    ]
  };
  writeJson(SCENARIOS_PATH, tampered);
  const result = runNode(['scripts/replayRegressionScenarios.mjs'], { REGRESSION_REPLAY_STRICT: 'true' });
  if (original) writeJson(SCENARIOS_PATH, original);

  return {
    guarantee_name: 'regression_replay_orphan_failure',
    trigger_used: 'tampered regression-scenarios with unknown gate signature',
    blocked_reason: blockedReasonFromOutput(result.output, 'BLOCKED: replay orphan'),
    exit_code: result.exit_code,
    raw: result
  };
}

function runSimulation(type) {
  if (type === 'fail-lkg-drift') return simulateLkgDrift();
  if (type === 'fail-schema-version') return simulateSchemaFailure();
  if (type === 'fail-latency-regression') return simulateLatencyFailure();
  if (type === 'fail-replay-orphan') return simulateReplayFailure();
  throw new Error(`Unsupported simulation type: ${type}`);
}

try {
  const result = runSimulation(mode);
  const payload = sign({
    schema_version: '1.0.0',
    artifact_origin: 'ci',
    guarantee_name: result.guarantee_name,
    trigger_used: result.trigger_used,
    blocked_reason: result.blocked_reason,
    exit_code: result.exit_code,
    timestamp: new Date().toISOString(),
    command: result.raw.command,
    output: result.raw.output
  });
  writeJson(logPathArg, payload);

  // Expected behavior: this simulation must fail and block.
  if (result.exit_code === 0) {
    console.error(`[ci-failure-sim] expected non-zero exit for ${mode}, got 0`);
    process.exit(99);
  }

  process.exit(result.exit_code);
} catch (error) {
  const payload = sign({
    schema_version: '1.0.0',
    artifact_origin: 'ci',
    guarantee_name: mode,
    trigger_used: 'simulation_exception',
    blocked_reason: `BLOCKED: simulation runtime error: ${error?.message || String(error)}`,
    exit_code: 98,
    timestamp: new Date().toISOString(),
    output: error?.stack || String(error)
  });
  writeJson(logPathArg, payload);
  process.exit(98);
}

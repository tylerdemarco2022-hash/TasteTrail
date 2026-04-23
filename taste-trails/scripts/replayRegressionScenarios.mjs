#!/usr/bin/env node
/**
 * Regression scenario replay runner.
 *
 * Reads scripts/regression-scenarios.json and validates that every captured
 * scenario has a corresponding test reference that exists in the codebase.
 * Then cross-checks that each gate_failure_signature is actively checked by
 * the release gate logic so nothing was silently removed.
 *
 * In CI, if any scenario is orphaned (its test_ref no longer exists or its
 * gate signature is no longer enforced), this script exits 1 to block release.
 *
 * Usage:
 *   node scripts/replayRegressionScenarios.mjs
 *
 * Environment:
 *   REGRESSION_REPLAY_STRICT=false  — default true; set false to warn-only
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SCENARIOS_PATH = path.join(ROOT, 'scripts', 'regression-scenarios.json');
const GATE_PATH = path.join(ROOT, 'scripts', 'releaseGateMenuIntegrity.mjs');
const RUNTIME_GUARD_PATH = path.join(ROOT, 'backend', 'server', 'utils', 'menuIntegrityRuntimeGuard.js');
const DIAGNOSTICS_ROUTE_PATH = path.join(ROOT, 'backend', 'server', 'routes', 'menu.js');
const STRICT = String(process.env.REGRESSION_REPLAY_STRICT || 'true').toLowerCase() !== 'false';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[regression-replay] failed to parse ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function grepFile(filePath, pattern) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(pattern);
  } catch {
    return false;
  }
}

function findInDir(dir, pattern) {
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findInDir(full, pattern)) return true;
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const isCodeFile = ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.ts';
      const isScenarioJson = path.resolve(full) === path.resolve(SCENARIOS_PATH);
      if (!isCodeFile || isScenarioJson) continue;
      if (grepFile(full, pattern)) return true;
    }
  }
  return false;
}

// Signature contracts that must remain enforced in source.
// Each signature maps to a file + required source fragment.
const GATE_ENFORCED_SIGNATURES = {
  any_silent_truncation: { filePath: GATE_PATH, fragment: 'any_silent_truncation' },
  any_fallback_masking_in_strict_mode: { filePath: GATE_PATH, fragment: 'any_fallback_masking_in_strict_mode' },
  any_count_mismatch: { filePath: GATE_PATH, fragment: 'any_count_mismatch' },
  unit_tests_failed: { filePath: GATE_PATH, fragment: 'BLOCKED: unit_tests_failed' },
  any_adversarial_test_failed: { filePath: GATE_PATH, fragment: 'any_adversarial_test_failed' },
  runtime_policy_fallback_flag_unsafe: { filePath: RUNTIME_GUARD_PATH, fragment: 'ALLOW_FALLBACK_ON_DB_ERROR_UNSAFE_IN_PROD' },
  latency_regression_blocked: { filePath: GATE_PATH, fragment: 'BLOCKED: p95 latency regression' },
  diagnostics_rate_limited: { filePath: DIAGNOSTICS_ROUTE_PATH, fragment: 'Too many diagnostics requests. Please slow down.' },
  diagnostics_summary_only_degradation: { filePath: DIAGNOSTICS_ROUTE_PATH, fragment: 'degraded_reason' }
};

// ─── Load scenarios ───────────────────────────────────────────────────────────

if (!fs.existsSync(SCENARIOS_PATH)) {
  console.error('[regression-replay] scenarios file not found:', SCENARIOS_PATH);
  process.exit(1);
}

const config = readJson(SCENARIOS_PATH);
const scenarios = Array.isArray(config?.scenarios) ? config.scenarios : [];

if (scenarios.length === 0) {
  console.error('[regression-replay] no scenarios found in scenarios file');
  process.exit(1);
}

const failures = [];
const results = [];

console.log(`[regression-replay] checking ${scenarios.length} regression scenario(s)...`);

// ─── Validate each scenario ───────────────────────────────────────────────────

for (const scenario of scenarios) {
  const id = String(scenario.id || '???');
  const testRef = String(scenario.test_ref || '').trim();
  const gateSignature = String(scenario.gate_failure_signature || '').trim();
  const scenarioResult = { id, name: scenario.name, test_ref_found: false, gate_signature_found: false };

  // 1. Check test_ref exists somewhere in the codebase (backend/tests + scripts).
  if (!testRef) {
    failures.push(`${id}:test_ref_missing`);
    results.push(scenarioResult);
    continue;
  }

  // Extract the key phrase from the test_ref for searching.
  // Format is usually "test_name in file.js" — look for the test_name portion.
  const testNamePart = testRef.split(' in ')[0].trim();
  const testFilePart = testRef.split(' in ')[1]?.trim();

  const testRefFoundInTests = findInDir(path.join(ROOT, 'backend', 'tests'), testNamePart);
  const testRefFoundInScripts = findInDir(path.join(ROOT, 'scripts'), testNamePart);
  scenarioResult.test_ref_found = testRefFoundInTests || testRefFoundInScripts;

  if (!scenarioResult.test_ref_found) {
    failures.push(`${id}:test_ref_not_found_in_codebase:${testNamePart}${testFilePart ? ` (expected in ${testFilePart})` : ''}`);
  }

  // 2. Check gate_failure_signature is still enforced by the gate.
  if (!gateSignature) {
    failures.push(`${id}:gate_failure_signature_missing`);
    results.push(scenarioResult);
    continue;
  }

  const signature = GATE_ENFORCED_SIGNATURES[gateSignature];
  if (!signature) {
    failures.push(`${id}:gate_failure_signature_unknown:${gateSignature}`);
  } else if (!grepFile(signature.filePath, signature.fragment)) {
    failures.push(
      `${id}:gate_failure_signature_not_enforced:${gateSignature}:file=${path.relative(ROOT, signature.filePath).replace(/\\/g, '/')}:fragment="${signature.fragment}"`
    );
    scenarioResult.gate_signature_found = false;
  } else {
    scenarioResult.gate_signature_found = true;
  }

  results.push(scenarioResult);
}

// ─── Report ───────────────────────────────────────────────────────────────────

const passCount = results.filter((r) => r.test_ref_found && r.gate_signature_found).length;
console.log(`[regression-replay] ${passCount}/${results.length} scenarios fully covered`);

for (const r of results) {
  const status = r.test_ref_found && r.gate_signature_found ? 'OK' : 'FAIL';
  console.log(
    `  [${status}] ${r.id} ${r.name} | test_ref=${r.test_ref_found ? 'found' : 'MISSING'} gate_sig=${r.gate_signature_found ? 'enforced' : 'MISSING'}`
  );
}

if (failures.length > 0) {
  console.error('[regression-replay] BLOCKED: orphaned or uncovered scenarios:', failures.join(', '));
  if (STRICT) {
    process.exit(1);
  } else {
    console.warn('[regression-replay] WARNING only (REGRESSION_REPLAY_STRICT=false)');
  }
} else {
  console.log('[regression-replay] PASS: all regression scenarios are covered by active tests and gate logic');
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'artifacts', 'menu-integrity', 'proof', 'failure-paths');
const BUNDLE_PATH = path.join(OUT_DIR, 'proof-bundle-index.json');
const PROOF_CI_PATH = path.join(OUT_DIR, 'proof-bundle-ci.json');
const VALIDATION_PATH = path.join(OUT_DIR, 'proof-bundle-validation.json');

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

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function writeValidation(payload) {
  fs.mkdirSync(path.dirname(VALIDATION_PATH), { recursive: true });
  const signed = {
    ...payload,
    artifact_sha256: canonicalSha256(payload)
  };
  fs.writeFileSync(VALIDATION_PATH, `${JSON.stringify(signed, null, 2)}\n`, 'utf8');
}

function parseTimeMs(iso) {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : NaN;
}

function main() {
  const errors = [];
  const guaranteesVerified = [];
  const guaranteesFailed = [];
  const artifactsUsed = new Set();
  const artifactTimestamps = [];

  const expectedCiJobs = {
    fail_lkg_drift: {
      job_name: 'fail-lkg-drift',
      artifact_name: 'ci-failure-lkg-drift.log',
      guarantee_name: 'lkg_drift_block',
      blocked_reason_match: 'last-known-good deviation exceeded threshold'
    },
    fail_schema_version: {
      job_name: 'fail-schema-version',
      artifact_name: 'ci-failure-schema.log',
      guarantee_name: 'schema_version_block',
      blocked_reason_match: 'schema_version_unsupported'
    },
    fail_latency_regression: {
      job_name: 'fail-latency-regression',
      artifact_name: 'ci-failure-latency.log',
      guarantee_name: 'latency_regression_block',
      blocked_reason_match: 'p95 latency regression'
    },
    fail_replay_orphan: {
      job_name: 'fail-replay-orphan',
      artifact_name: 'ci-failure-replay.log',
      guarantee_name: 'regression_replay_orphan_failure',
      blocked_reason_match: 'orphaned or uncovered scenarios'
    }
  };

  const bundle = readJson(BUNDLE_PATH);
  if (!bundle) {
    writeValidation({
      generated_at: new Date().toISOString(),
      guarantees_verified: [],
      guarantees_failed: ['proof_bundle_missing'],
      evidence_complete: false,
      errors: ['proof-bundle-index.json is missing']
    });
    process.exit(1);
  }

  const runStart = parseTimeMs(bundle?.run_window?.started_at);
  const runEnd = parseTimeMs(bundle?.run_window?.ended_at);
  if (!Number.isFinite(runStart) || !Number.isFinite(runEnd) || runEnd < runStart) {
    errors.push('run_window_invalid');
  }

  const guarantees = bundle?.guarantees || {};
  const guaranteeEntries = Object.entries(guarantees);
  if (guaranteeEntries.length === 0) {
    errors.push('guarantees_missing');
  }

  for (const [guaranteeName, guarantee] of guaranteeEntries) {
    const passArtifactRel = String(guarantee?.pass_artifact || '').trim();
    const failArtifactRel = String(guarantee?.fail_artifact || '').trim();

    if (!passArtifactRel || !failArtifactRel) {
      guaranteesFailed.push(guaranteeName);
      errors.push(`${guaranteeName}:missing_pass_or_fail_artifact`);
      continue;
    }

    const passArtifactPath = path.join(ROOT, passArtifactRel);
    const failArtifactPath = path.join(ROOT, failArtifactRel);

    if (!fs.existsSync(passArtifactPath)) errors.push(`${guaranteeName}:pass_artifact_missing`);
    if (!fs.existsSync(failArtifactPath)) errors.push(`${guaranteeName}:fail_artifact_missing`);

    const passKey = `pass:${passArtifactRel}`;
    const failKey = `fail:${failArtifactRel}`;

    if (artifactsUsed.has(passKey)) errors.push(`${guaranteeName}:pass_artifact_reused`);
    if (artifactsUsed.has(failKey)) errors.push(`${guaranteeName}:fail_artifact_reused`);
    artifactsUsed.add(passKey);
    artifactsUsed.add(failKey);

    const passPayload = readJson(passArtifactPath);
    const failPayload = readJson(failArtifactPath);

    if (!passPayload) errors.push(`${guaranteeName}:pass_artifact_invalid_json`);
    if (!failPayload) errors.push(`${guaranteeName}:fail_artifact_invalid_json`);

    const blockedReason = String(failPayload?.blocked_reason || '');
    if (!blockedReason.includes('BLOCKED')) {
      errors.push(`${guaranteeName}:fail_artifact_missing_blocked_reason`);
    }

    const passTs = parseTimeMs(passPayload?.generated_at);
    const failTs = parseTimeMs(failPayload?.generated_at);
    if (!Number.isFinite(passTs)) errors.push(`${guaranteeName}:pass_artifact_timestamp_missing`);
    if (!Number.isFinite(failTs)) errors.push(`${guaranteeName}:fail_artifact_timestamp_missing`);

    artifactTimestamps.push({ guaranteeName, type: 'pass', ts: passTs });
    artifactTimestamps.push({ guaranteeName, type: 'fail', ts: failTs });

    const ok = Boolean(guarantee?.pass_ok) && Boolean(guarantee?.fail_ok);
    if (ok) guaranteesVerified.push(guaranteeName);
    else guaranteesFailed.push(guaranteeName);
  }

  for (const item of artifactTimestamps) {
    if (!Number.isFinite(item.ts) || !Number.isFinite(runStart) || !Number.isFinite(runEnd)) continue;
    if (item.ts < runStart || item.ts > runEnd) {
      errors.push(`${item.guaranteeName}:${item.type}_artifact_outside_run_window`);
    }
  }

  const proofCi = readJson(PROOF_CI_PATH);
  if (!proofCi) {
    errors.push('proof_bundle_ci_missing');
  } else {
    if (proofCi.executed_in_ci !== true) {
      errors.push('proof_bundle_ci_not_executed_in_ci');
    }

    const perJob = proofCi.per_job || {};
    for (const [key, expectation] of Object.entries(expectedCiJobs)) {
      const job = perJob[key];
      if (!job) {
        errors.push(`proof_bundle_ci_missing_job:${key}`);
        continue;
      }
      if (String(job.job_name || '') !== expectation.job_name) {
        errors.push(`proof_bundle_ci_job_name_mismatch:${key}`);
      }
      if (String(job.uploaded_artifact_name || '') !== expectation.artifact_name) {
        errors.push(`proof_bundle_ci_artifact_name_mismatch:${key}`);
      }
      if (String(job.conclusion || '') !== 'failure') {
        errors.push(`proof_bundle_ci_job_not_failed_as_expected:${key}`);
      }
      if (!Number.isFinite(Number(job.exit_code)) || Number(job.exit_code) === 0) {
        errors.push(`proof_bundle_ci_job_exit_code_invalid:${key}`);
      }

      const ciLogPath = path.join(OUT_DIR, expectation.artifact_name);
      if (!fs.existsSync(ciLogPath)) {
        errors.push(`proof_bundle_ci_artifact_missing:${expectation.artifact_name}`);
        continue;
      }

      const ciLog = readJson(ciLogPath);
      if (!ciLog) {
        errors.push(`proof_bundle_ci_artifact_not_json:${expectation.artifact_name}`);
        continue;
      }
      if (String(ciLog.artifact_origin || '') !== 'ci') {
        errors.push(`proof_bundle_ci_artifact_origin_invalid:${expectation.artifact_name}`);
      }
      if (String(ciLog.guarantee_name || '') !== expectation.guarantee_name) {
        errors.push(`proof_bundle_ci_log_guarantee_mismatch:${expectation.artifact_name}`);
      }
      if (!String(ciLog.blocked_reason || '').includes(expectation.blocked_reason_match)) {
        errors.push(`proof_bundle_ci_log_blocked_reason_mismatch:${expectation.artifact_name}`);
      }
      if (!Number.isFinite(parseTimeMs(ciLog.timestamp))) {
        errors.push(`proof_bundle_ci_log_timestamp_missing:${expectation.artifact_name}`);
      }
    }
  }

  const expectedComplete = guaranteesFailed.length === 0 && errors.length === 0;
  const bundleClaimsComplete = bundle?.evidence_complete === true;
  if (bundleClaimsComplete !== expectedComplete) {
    errors.push('bundle_evidence_complete_flag_mismatch');
  }

  const output = {
    generated_at: new Date().toISOString(),
    bundle: rel(BUNDLE_PATH),
    guarantees_verified: guaranteesVerified,
    guarantees_failed: guaranteesFailed,
    evidence_complete: errors.length === 0 && guaranteesFailed.length === 0,
    errors
  };

  writeValidation(output);

  if (!output.evidence_complete) {
    process.exit(1);
  }

  console.log('[proof-bundle-validation] PASS');
}

main();
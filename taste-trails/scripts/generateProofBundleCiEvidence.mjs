#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'artifacts', 'menu-integrity', 'proof', 'failure-paths');
const OUT_PATH = path.join(OUT_DIR, 'proof-bundle-ci.json');

const REQUIRED_JOBS = [
  {
    key: 'fail_lkg_drift',
    envPrefix: 'CI_FAIL_LKG',
    jobName: 'fail-lkg-drift',
    expectedArtifact: 'ci-failure-lkg-drift.log'
  },
  {
    key: 'fail_schema_version',
    envPrefix: 'CI_FAIL_SCHEMA',
    jobName: 'fail-schema-version',
    expectedArtifact: 'ci-failure-schema.log'
  },
  {
    key: 'fail_latency_regression',
    envPrefix: 'CI_FAIL_LATENCY',
    jobName: 'fail-latency-regression',
    expectedArtifact: 'ci-failure-latency.log'
  },
  {
    key: 'fail_replay_orphan',
    envPrefix: 'CI_FAIL_REPLAY',
    jobName: 'fail-replay-orphan',
    expectedArtifact: 'ci-failure-replay.log'
  }
];

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

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required CI environment variable: ${name}`);
  return value;
}

function main() {
  if (String(process.env.GITHUB_ACTIONS || '').toLowerCase() !== 'true') {
    throw new Error('proof-bundle-ci generation must run in GitHub Actions CI; refusing to emit local placeholder');
  }

  const workflowRunId = requiredEnv('GITHUB_RUN_ID');
  const workflowRunAttempt = requiredEnv('GITHUB_RUN_ATTEMPT');

  const perJob = {};
  for (const job of REQUIRED_JOBS) {
    const conclusion = requiredEnv(`${job.envPrefix}_CONCLUSION`);
    const exitCodeRaw = requiredEnv(`${job.envPrefix}_EXIT_CODE`);
    const artifactName = requiredEnv(`${job.envPrefix}_ARTIFACT_NAME`);
    const githubJobIdRaw = String(process.env[`${job.envPrefix}_JOB_ID`] || '').trim();

    perJob[job.key] = {
      job_name: job.jobName,
      github_job_id: githubJobIdRaw ? githubJobIdRaw : null,
      github_job_id_reason: githubJobIdRaw ? null : 'GitHub Actions does not expose job id in standard runtime context for dependent jobs',
      conclusion,
      exit_code: toInt(exitCodeRaw, null),
      uploaded_artifact_name: artifactName
    };
  }

  const payload = sign({
    schema_version: '1.0.0',
    artifact_origin: 'ci',
    generated_at: new Date().toISOString(),
    executed_in_ci: true,
    workflow_run_id: workflowRunId,
    workflow_run_attempt: toInt(workflowRunAttempt, null),
    per_job: perJob
  });

  writeJson(OUT_PATH, payload);
  console.log(`[proof-bundle-ci] wrote ${path.relative(ROOT, OUT_PATH).replace(/\\/g, '/')}`);
}

try {
  main();
} catch (error) {
  console.error('[proof-bundle-ci] failed:', error?.message || String(error));
  process.exit(1);
}

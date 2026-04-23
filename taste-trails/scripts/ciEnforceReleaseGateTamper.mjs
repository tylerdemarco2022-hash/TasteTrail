#!/usr/bin/env node
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const GATE_FILE = 'scripts/releaseGateMenuIntegrity.mjs';
const baseSha = String(process.env.RELEASE_GATE_BASE_SHA || '').trim();
const headSha = String(process.env.RELEASE_GATE_HEAD_SHA || '').trim();
const override = String(process.env.RELEASE_GATE_CHANGE_OVERRIDE || '').toLowerCase() === 'true';

function runGit(args) {
  return spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

if (!baseSha || !headSha) {
  console.log('[gate-tamper-guard] SKIP: missing base/head SHA context');
  process.exit(0);
}

const diff = runGit(['diff', '--name-only', baseSha, headSha, '--', GATE_FILE]);
if (diff.status !== 0) {
  console.error('[gate-tamper-guard] BLOCKED: unable to diff gate file changes');
  if (diff.stderr) process.stderr.write(diff.stderr);
  process.exit(1);
}

const changed = diff.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .includes(GATE_FILE);

if (changed && !override) {
  console.error('[gate-tamper-guard] BLOCKED: release gate logic changed without override');
  console.error('[gate-tamper-guard] To proceed, set RELEASE_GATE_CHANGE_OVERRIDE=true in CI.');
  process.exit(1);
}

if (changed && override) {
  console.warn('[gate-tamper-guard] OVERRIDE: gate file changed and explicit override is set');
} else {
  console.log('[gate-tamper-guard] PASS: gate file unchanged');
}

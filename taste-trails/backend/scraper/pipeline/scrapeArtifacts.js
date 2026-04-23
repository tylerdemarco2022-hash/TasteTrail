/**
 * Scrape Artifacts for Debugging
 *
 * For each scrape session, write debug files to:
 *   <tmpdir>/tastetrails/scrapes/<domain>/<sessionId>/
 *   - request_url.txt, final_url.txt
 *   - html_raw.html, html_rendered.html (if used)
 *   - parse_result.json
 *   - debug.json (provider, bot flags, confidence components)
 *   - discovery.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function generateSessionId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function startScrapeSession(domain) {
  const sessionId = generateSessionId();
  const baseDir = path.join(os.tmpdir(), 'tastetrails', 'scrapes', domain, sessionId);
  try {
    fs.mkdirSync(baseDir, { recursive: true });
  } catch (err) {
    console.error(`[scrapeArtifacts] Failed to create session dir: ${err.message}`);
    // Fallback to a simpler path
    const fallback = path.join(os.tmpdir(), 'tastetrails', sessionId);
    fs.mkdirSync(fallback, { recursive: true });
    return { sessionId, baseDir: fallback };
  }
  return { sessionId, baseDir };
}

export function saveArtifact(baseDir, filename, content) {
  try {
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, String(content || ''));
    return filePath;
  } catch (err) {
    console.error(`[scrapeArtifacts] Failed to save ${filename}: ${err.message}`);
    return null;
  }
}

export function saveJsonArtifact(baseDir, filename, obj) {
  try {
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    return filePath;
  } catch (err) {
    console.error(`[scrapeArtifacts] Failed to save ${filename}: ${err.message}`);
    return null;
  }
}

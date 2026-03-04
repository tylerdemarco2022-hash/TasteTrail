// URL discovery service (no Yelp dependency)
import fs from 'fs';
import path from 'path';
import { safeJsonParse } from '../utils/safeJsonParse.js';

const manualPlatforms = [
  'toasttab.com',
  'clover.com',
  'chownow.com',
  'order.online',
  'singleplatform.com',
  'squarespace.com',
  'wordpress.com'
];

const commonPaths = [
  '/menu',
  '/menus',
  '/dinner',
  '/food',
  '/eat',
  '/order',
  '/food-menu',
  '/dinner-menu',
  '/lunch-menu'
];

const SEARCH_BLOCKLIST_HOSTS = [
  'yelp.com',
  'tripadvisor.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'foursquare.com'
];

const MENU_HINT_REGEX = /(menu|menus|dinner|lunch|brunch|food|drink|cocktail|wine|beer)/i;
const ORDER_HINT_REGEX = /(order|toasttab|clover|doordash|ubereats|grubhub|pickup|carryout|takeout|call[\s-]?ahead)/i;
const ORDER_ONLY_PATH_REGEX = /(order-online|online-order|pickup|carryout|takeout|call[\s-]?ahead|\/order(?:\/|$))/i;
const SUSPICIOUS_ASSET_EXT_REGEX = /\.(js|css|map|ico|png|jpe?g|gif|webp|svg)(\?.*)?$/i;
const DEFAULT_MIN_URL_CONFIDENCE = 0.8;
const ORDER_PLATFORM_HOSTS = ['toasttab.com', 'clover.com', 'doordash.com', 'ubereats.com', 'grubhub.com', 'order.online'];
const MENU_AGGREGATOR_HOSTS = ['singleplatform.com', 'allmenus.com', 'menucollectors.com', 'restaurantji.com'];

const MENU_URLS_PATH = path.resolve(process.cwd(), 'menu-urls-found.json');
const MANUAL_MENU_SOURCES_PATH = path.resolve(process.cwd(), 'backend', 'scraper', 'manual_menu_sources.json');
const REQUEST_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function resolveMinUrlConfidence() {
  const parsed = Number(process.env.MIN_URL_CONFIDENCE);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_URL_CONFIDENCE;
  return clamp01(parsed);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeRestaurantKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCandidateUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return null;
}

function decodeDuckDuckGoRedirect(href = '') {
  const normalized = normalizeCandidateUrl(href) || href;
  if (!normalized) return null;

  if (!/duckduckgo\.com\/l\/\?/i.test(normalized)) {
    return normalizeCandidateUrl(normalized);
  }

  try {
    const parsed = new URL(normalized.startsWith('http') ? normalized : `https://duckduckgo.com${normalized}`);
    const encoded = parsed.searchParams.get('uddg');
    if (!encoded) return null;
    return normalizeCandidateUrl(decodeURIComponent(encoded));
  } catch (_) {
    return null;
  }
}

function extractHostname(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
}

function isBlockedHost(hostname = '') {
  return SEARCH_BLOCKLIST_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
}

function dedupeUrls(urls = []) {
  const unique = [];
  const seen = new Set();
  for (const candidate of urls) {
    const normalized = normalizeCandidateUrl(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function pushSearchCandidate(rawValue = '', seen = new Set(), out = []) {
  const value = String(rawValue || '').replace(/&amp;/g, '&').trim();
  if (!value) return;

  const decoded = decodeDuckDuckGoRedirect(value);
  const normalized = decoded || normalizeCandidateUrl(value);
  if (!normalized) return;

  const host = extractHostname(normalized);
  if (!host || isBlockedHost(host)) return;
  if (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) return;
  if (SUSPICIOUS_ASSET_EXT_REGEX.test(normalized.toLowerCase())) return;

  if (seen.has(normalized)) return;
  seen.add(normalized);
  out.push(normalized);
}

function extractSearchCandidatesFromHtml(html = '', seen = new Set(), out = []) {
  const text = String(html || '');
  if (!text) return;

  const anchorRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi;
  let match = null;
  while ((match = anchorRegex.exec(text)) !== null) {
    pushSearchCandidate(match[1], seen, out);
    if (out.length >= 20) return;
  }

  const uddgRegex = /uddg=([^"&]+)/gi;
  let redirectMatch = null;
  while ((redirectMatch = uddgRegex.exec(text)) !== null) {
    const encoded = String(redirectMatch[1] || '');
    if (!encoded) continue;
    try {
      pushSearchCandidate(decodeURIComponent(encoded), seen, out);
    } catch (_) {
      pushSearchCandidate(encoded, seen, out);
    }
    if (out.length >= 20) return;
  }

  const directUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
  let directMatch = null;
  while ((directMatch = directUrlRegex.exec(text)) !== null) {
    pushSearchCandidate(directMatch[0], seen, out);
    if (out.length >= 20) return;
  }
}

function getNameToken(normalizedName = '') {
  if (!normalizedName) return '';
  return normalizedName.slice(0, Math.min(normalizedName.length, 12));
}

function buildStructuralSignals(url, normalizedName = '', source = 'search') {
  const normalizedUrl = normalizeCandidateUrl(url);
  if (!normalizedUrl) {
    return {
      url: null,
      source,
      blocked_host: false,
      structural_score: 0,
      signals: {
        invalid_url_penalty: -50
      }
    };
  }

  const parsed = new URL(normalizedUrl);
  const host = parsed.hostname.toLowerCase();
  const pathName = `${parsed.pathname || ''}${parsed.search || ''}`.toLowerCase();
  const lower = normalizedUrl.toLowerCase();
  const compactHost = host.replace(/^www\./, '').replace(/[^a-z0-9]/g, '');
  const compactPath = pathName.replace(/[^a-z0-9]/g, '');
  const nameToken = getNameToken(normalizedName);
  const blockedHost = isBlockedHost(host);
  const hasMenuHint = MENU_HINT_REGEX.test(lower);
  const hasOrderHint = ORDER_HINT_REGEX.test(lower) || ORDER_ONLY_PATH_REGEX.test(pathName);
  const isOrderPlatform = ORDER_PLATFORM_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  const isMenuAggregator = MENU_AGGREGATOR_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));

  const sourceBonus =
    source === 'manual' ? 25 :
    source === 'search' ? 10 :
    source === 'guess' ? 4 : 0;
  const menuKeywordScore = hasMenuHint ? 20 : 0;
  const orderKeywordScore = hasOrderHint && hasMenuHint ? 2 : 0;
  const platformScore = manualPlatforms.some((platform) => host.endsWith(platform)) ? 14 : 0;
  const hostNameScore = nameToken && compactHost.includes(nameToken) ? 12 : 0;
  const pathNameScore = nameToken && compactPath.includes(nameToken) ? 8 : 0;
  const httpsScore = parsed.protocol === 'https:' ? 2 : 0;
  const pdfScore = /\.pdf($|\?)/i.test(pathName) ? 12 : 0;
  const orderOnlyPenalty = hasOrderHint && !hasMenuHint ? -14 : 0;
  const orderPathPenalty = ORDER_ONLY_PATH_REGEX.test(pathName) ? -10 : 0;
  const orderPlatformPenalty = isOrderPlatform && !hasMenuHint ? -10 : 0;
  const menuAggregatorPenalty = isMenuAggregator && !/\.pdf($|\?)/i.test(pathName) ? -10 : 0;
  const blockedPenalty = blockedHost ? -40 : 0;
  const assetPenalty = SUSPICIOUS_ASSET_EXT_REGEX.test(pathName) ? -18 : 0;

  const structuralScore = clamp(
    sourceBonus +
      menuKeywordScore +
      orderKeywordScore +
      platformScore +
      hostNameScore +
      pathNameScore +
      httpsScore +
      pdfScore +
      orderOnlyPenalty +
      orderPathPenalty +
      orderPlatformPenalty +
      menuAggregatorPenalty +
      blockedPenalty +
      assetPenalty,
    0,
    70
  );

  return {
    url: normalizedUrl,
    source,
    blocked_host: blockedHost,
    structural_score: structuralScore,
    signals: {
      source_bonus: sourceBonus,
      menu_keyword_score: menuKeywordScore,
      order_keyword_score: orderKeywordScore,
      platform_score: platformScore,
      host_name_score: hostNameScore,
      path_name_score: pathNameScore,
      https_score: httpsScore,
      pdf_score: pdfScore,
      order_only_penalty: orderOnlyPenalty,
      order_path_penalty: orderPathPenalty,
      order_platform_penalty: orderPlatformPenalty,
      menu_aggregator_penalty: menuAggregatorPenalty,
      blocked_penalty: blockedPenalty,
      asset_penalty: assetPenalty
    }
  };
}

async function probeUrl(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': REQUEST_USER_AGENT
      }
    });

    return {
      ok: !!res.ok,
      status: res.status,
      final_url: normalizeCandidateUrl(res.url) || url,
      content_type: (res.headers.get('content-type') || '').toLowerCase(),
      error: null
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      final_url: normalizeCandidateUrl(url) || null,
      content_type: '',
      error: err?.message || String(err)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildConfidenceReport(structural, probe, method = 'unknown') {
  const finalUrl = probe?.final_url || structural?.url || null;
  const finalHost = extractHostname(finalUrl || '');
  const blockedFinal = isBlockedHost(finalHost);

  let validationScore = 0;
  if (probe?.ok) validationScore += 20;
  if (typeof probe?.status === 'number') {
    if (probe.status >= 200 && probe.status < 300) validationScore += 8;
    else if (probe.status >= 300 && probe.status < 400) validationScore += 4;
    else if (probe.status >= 400) validationScore -= 8;
  }

  const contentType = probe?.content_type || '';
  const hasMenuHint = MENU_HINT_REGEX.test(finalUrl || '');
  const hasOrderHint = ORDER_HINT_REGEX.test(finalUrl || '') || ORDER_ONLY_PATH_REGEX.test(finalUrl || '');
  if (contentType.includes('text/html')) validationScore += 8;
  else if (contentType.includes('application/pdf')) validationScore += 10;
  else if (contentType.includes('application/json')) validationScore += 5;
  else if (probe?.ok) validationScore += 2;

  if (hasMenuHint) validationScore += 6;
  if (hasOrderHint && !hasMenuHint) validationScore -= 8;
  if (blockedFinal) validationScore -= 30;
  if (probe?.error) validationScore -= 8;

  validationScore = clamp(validationScore, -35, 45);
  const totalScore = clamp((structural?.structural_score || 0) + validationScore, 0, 100);
  const confidence = round2(clamp01(totalScore / 100));
  const tier =
    confidence >= 0.85 ? 'high' :
    confidence >= 0.65 ? 'medium' :
    confidence >= 0.45 ? 'low' : 'very_low';

  return {
    version: 'url_discovery_confidence_v1',
    method,
    url: structural?.url || null,
    final_url: finalUrl,
    confidence,
    tier,
    total_score: round2(totalScore),
    structural_score: round2(structural?.structural_score || 0),
    validation_score: round2(validationScore),
    signals: structural?.signals || {},
    probe: {
      ok: !!probe?.ok,
      status: probe?.status ?? null,
      content_type: contentType || '',
      error: probe?.error || null
    }
  };
}

async function scoreCandidates(
  candidates = [],
  normalizedName = '',
  source = 'search',
  probeLimit = 10,
  seedCount = 0
) {
  const allRows = candidates
    .map((url, index) => ({ ...buildStructuralSignals(url, normalizedName, source), index }))
    .filter((row) => row.url && !row.blocked_host);

  const seedRows = allRows
    .filter((row) => row.index < seedCount)
    .sort((a, b) => a.index - b.index);

  const topRows = [...allRows]
    .sort((a, b) => b.structural_score - a.structural_score)
    .slice(0, probeLimit);

  const structural = [];
  const seen = new Set();
  for (const row of [...seedRows, ...topRows]) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    structural.push(row);
  }

  const reports = [];
  for (const row of structural) {
    const probe = await probeUrl(row.url, 10000);
    reports.push(buildConfidenceReport(row, probe, source));
  }

  reports.sort((a, b) => b.total_score - a.total_score);
  return reports;
}

function readManualMenuUrls() {
  try {
    if (!fs.existsSync(MENU_URLS_PATH)) return {};
    const raw = fs.readFileSync(MENU_URLS_PATH, 'utf8');
    console.log('[JSONPARSE] Length:', raw.length);
    console.log('[JSONPARSE] First 300 chars:', raw.slice(0, 300));
    if (raw.length > 2800) {
      console.log('[JSONPARSE] Chars 2700-2800:', raw.slice(2700, 2800));
    }
    console.log('[JSONPARSE] Raw string:', raw);
    try {
      return safeJsonParse('urlDiscovery:menu-urls-found.json', raw);
    } catch (err) {
      console.log('[JSONPARSE] Invalid JSON payload detected. Error:', err.message);
      return {};
    }
  } catch (_) {
    return {};
  }
}

function readCuratedManualSources() {
  try {
    if (!fs.existsSync(MANUAL_MENU_SOURCES_PATH)) return {};
    const raw = fs.readFileSync(MANUAL_MENU_SOURCES_PATH, 'utf8');
    console.log('[JSONPARSE] Length:', raw.length);
    console.log('[JSONPARSE] First 300 chars:', raw.slice(0, 300));
    if (raw.length > 2800) {
      console.log('[JSONPARSE] Chars 2700-2800:', raw.slice(2700, 2800));
    }
    console.log('[JSONPARSE] Raw string:', raw);
    let parsed = {};
    try {
      parsed = safeJsonParse('urlDiscovery:manual_menu_sources.json', raw);
    } catch (err) {
      console.log('[JSONPARSE] Invalid JSON payload detected. Error:', err.message);
      return {};
    }
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (_) {
    return {};
  }
}

function extractFirstUrlFromEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return normalizeCandidateUrl(entry);
  if (Array.isArray(entry)) {
    for (const row of entry) {
      const candidate = extractFirstUrlFromEntry(row);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof entry === 'object') return normalizeCandidateUrl(entry.url || entry.href || '');
  return null;
}

function findManualUrlForName(name = '') {
  const curated = readCuratedManualSources();
  const normalizedName = normalizeRestaurantKey(name);

  const extractCurated = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    return normalizeCandidateUrl(entry.source_url || entry.url || '');
  };

  const curatedDirect = extractCurated(curated[name]);
  if (curatedDirect) return curatedDirect;

  for (const [key, value] of Object.entries(curated)) {
    if (normalizeRestaurantKey(key) !== normalizedName) continue;
    const curatedUrl = extractCurated(value);
    if (curatedUrl) return curatedUrl;
  }

  const menuUrls = readManualMenuUrls();

  const direct = extractFirstUrlFromEntry(menuUrls[name]);
  if (direct) return direct;

  const byNormalizedKey = extractFirstUrlFromEntry(menuUrls[normalizedName]);
  if (byNormalizedKey) return byNormalizedKey;

  for (const [key, value] of Object.entries(menuUrls)) {
    if (normalizeRestaurantKey(key) !== normalizedName) continue;
    const candidate = extractFirstUrlFromEntry(value);
    if (candidate) return candidate;
  }

  return null;
}

async function discoverViaDuckDuckGo(name = '') {
  const normalizedName = normalizeRestaurantKey(name);
  const minUrlConfidence = resolveMinUrlConfidence();
  const queries = [
    `${name} official menu`,
    `${name} restaurant menu`,
    `${name} order online`
  ];

  const discovered = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const endpoints = [
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      ];

      for (const [endpointIndex, endpoint] of endpoints.entries()) {
        try {
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'User-Agent': REQUEST_USER_AGENT
            }
          });
          if (!res.ok) continue;

          const html = await res.text();
          const before = discovered.length;
          extractSearchCandidatesFromHtml(html, seen, discovered);
          const gained = discovered.length - before;
          if (discovered.length >= 20) break;

          // If direct DDG HTML already produced enough candidates, skip the mirror fallback.
          if (endpointIndex === 0 && gained >= 6) break;
        } catch (_) {}
      }
    } catch (_) {}

    if (discovered.length >= 20) break;
  }

  const uniqueCandidates = dedupeUrls(discovered);
  if (!uniqueCandidates.length) {
    return {
      url: null,
      confidence: 0,
      method: 'duckduckgo',
      confidence_report: {
        version: 'url_discovery_confidence_v1',
        method: 'duckduckgo',
        confidence: 0,
        tier: 'very_low',
        reason: 'no_candidates'
      }
    };
  }

  const reports = await scoreCandidates(uniqueCandidates, normalizedName, 'search', 12, 0);
  const best = reports.find((row) => row.probe.ok) || reports[0] || null;
  if (!best || !best.probe.ok || best.confidence < minUrlConfidence) {
    return {
      url: null,
      confidence: 0,
      method: 'duckduckgo',
      confidence_report: {
        version: 'url_discovery_confidence_v1',
        method: 'duckduckgo',
        confidence: 0,
        tier: 'very_low',
        reason: !best || !best.probe.ok ? 'all_candidates_failed_probe' : 'below_min_confidence_threshold',
        min_required_confidence: minUrlConfidence,
        best_candidate: best || null,
        top_candidates: reports.slice(0, 3)
      }
    };
  }

  return {
    url: best.final_url || best.url,
    confidence: best.confidence,
    method: 'duckduckgo',
    confidence_report: {
      ...best,
      top_candidates: reports.slice(0, 3)
    }
  };
}

async function discoverViaGuesses(name = '') {
  const lowerName = normalizeRestaurantKey(name);
  const minUrlConfidence = resolveMinUrlConfidence();
  if (!lowerName) {
    return {
      url: null,
      confidence: 0,
      method: 'guess',
      confidence_report: {
        version: 'url_discovery_confidence_v1',
        method: 'guess',
        confidence: 0,
        tier: 'very_low',
        reason: 'invalid_restaurant_name'
      }
    };
  }

  const slugName = String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const candidates = [];
  if (slugName) {
    candidates.push(`https://places.singleplatform.com/${slugName}/menu`);
  }
  for (const platform of manualPlatforms) {
    candidates.push(`https://www.${lowerName}.${platform}`);
    candidates.push(`https://${lowerName}.${platform}`);
  }
  candidates.push(`https://www.${lowerName}.com`);
  candidates.push(`https://${lowerName}.com`);

  const baseCandidates = [...candidates];
  for (const domain of baseCandidates) {
    for (const p of commonPaths) {
      candidates.push(`${domain}${p}`);
    }
  }

  const uniqueCandidates = dedupeUrls(candidates);
  const reports = await scoreCandidates(uniqueCandidates, lowerName, 'guess', 20, 14);
  const best = reports.find((row) => row.probe.ok) || reports[0] || null;
  if (!best || !best.probe.ok || best.confidence < minUrlConfidence) {
    return {
      url: null,
      confidence: 0,
      method: 'guess',
      confidence_report: {
        version: 'url_discovery_confidence_v1',
        method: 'guess',
        confidence: 0,
        tier: 'very_low',
        reason: !best || !best.probe.ok ? 'all_candidates_failed_probe' : 'below_min_confidence_threshold',
        min_required_confidence: minUrlConfidence,
        best_candidate: best || null,
        top_candidates: reports.slice(0, 3)
      }
    };
  }

  return {
    url: best.final_url || best.url,
    confidence: best.confidence,
    method: 'guess',
    confidence_report: {
      ...best,
      top_candidates: reports.slice(0, 3)
    }
  };
}

export async function discoverRestaurantURL(name) {
  const startTime = Date.now();
  const normalizedName = normalizeRestaurantKey(name);
  const minUrlConfidence = resolveMinUrlConfidence();
  const manualUrl = findManualUrlForName(name);
  
  console.log(`[DISCOVERY:P1] Starting discovery for "${name}"...`);
  
  let manualFailure = null;
  if (manualUrl) {
    const structural = buildStructuralSignals(manualUrl, normalizedName, 'manual');
    const probe = await probeUrl(structural.url, 5000);  // Reduced from 8s to 5s
    const report = buildConfidenceReport(structural, probe, 'manual');
    const manualUrlLooksStrong =
      !!structural?.url &&
      !structural?.blocked_host &&
      MENU_HINT_REGEX.test(structural.url || '');
    if (report.probe.ok && report.confidence >= minUrlConfidence) {
      const elapsed = Date.now() - startTime;
      console.log(`[DISCOVERY:OK] Found via manual source (${elapsed}ms)`);
      return {
        url: report.final_url || structural.url,
        confidence: report.confidence,
        method: 'manual',
        confidence_report: report
      };
    }

    // Curated manual sources can be valid even when probe fails due transient bot protection.
    // Prefer manual URL over low-quality guess/aggregator fallbacks when the manual URL is menu-ish.
    if (manualUrlLooksStrong) {
      const elapsed = Date.now() - startTime;
      const fallbackConfidence = Math.max(minUrlConfidence, 0.85);
      console.log(`[DISCOVERY:OK] Using manual fallback despite probe failure (${elapsed}ms)`);
      return {
        url: structural.url,
        confidence: fallbackConfidence,
        method: 'manual',
        confidence_report: {
          ...report,
          confidence: fallbackConfidence,
          tier: fallbackConfidence >= 0.85 ? 'high' : 'medium',
          reason: report.probe.ok ? 'manual_preferred_fallback' : 'manual_probe_failed_fallback',
          min_required_confidence: minUrlConfidence
        }
      };
    }

    manualFailure = {
      url: null,
      confidence: 0,
      method: 'manual',
      confidence_report: {
        ...report,
        confidence: 0,
        tier: 'very_low',
        reason: !report.probe.ok ? 'manual_url_failed_probe' : 'below_min_confidence_threshold',
        min_required_confidence: minUrlConfidence
      }
    };
  }

  // Run DuckDuckGo and guessing in parallel instead of sequentially
  console.log(`[DISCOVERY:P2] Running parallel search methods...`);
  const [searchResult, guessResult] = await Promise.all([
    discoverViaDuckDuckGo(name),
    discoverViaGuesses(name)
  ]);
  
  if (searchResult.url) {
    const elapsed = Date.now() - startTime;
    console.log(`[DISCOVERY:OK] Found via DuckDuckGo (${elapsed}ms)`);
    return searchResult;
  }
  
  if (guessResult.url) {
    const elapsed = Date.now() - startTime;
    console.log(`[DISCOVERY:OK] Found via guesses (${elapsed}ms)`);
    return guessResult;
  }

  if (manualFailure) {
    const elapsed = Date.now() - startTime;
    console.log(`[DISCOVERY:FAIL] No URL found after ${elapsed}ms`);
    return manualFailure;
  }

  const elapsed = Date.now() - startTime;
  console.log(`[DISCOVERY:FAIL] All methods exhausted (${elapsed}ms)`);
  return {
    url: null,
    confidence: 0,
    method: guessResult?.method || searchResult?.method || 'unknown',
    confidence_report: guessResult?.confidence_report || searchResult?.confidence_report || null
  };
}

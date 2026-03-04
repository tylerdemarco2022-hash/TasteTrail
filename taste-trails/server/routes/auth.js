import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../../backend/supabase.js";
import { readJSON, writeJSON } from "../../backend/utils/localDB.js";

const router = express.Router();
const ACCESS_TOKEN_TTL_MS = Number(process.env.ACCESS_TOKEN_TTL_MS || 15 * 60 * 1000); // 15 minutes
const REFRESH_TOKEN_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000); // 30 days
const localSessions = new Map(); // Legacy: for access tokens
const localRefreshTokens = new Map(); // Store refresh tokens: token -> { userId, expiresAt, tokenHash }
const loginAttempts = new Map(); // Track failed login attempts: email -> { count, lockedUntil }
const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || 5000);
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ""
).trim();
const hasSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes("your-") &&
  !supabaseUrl.includes("example") &&
  !supabaseKey.includes("your-") &&
  !supabaseKey.includes("example")
);

const PROFILE_SELECT =
  "id,email,name,role,is_private,user_code,created_at,updated_at,avatar_url,auth_provider,google_id";

const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const GOOGLE_REDIRECT_URI = String(process.env.GOOGLE_REDIRECT_URI || "").trim();
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || "http://localhost:5174").trim();
const FRONTEND_AUTH_REDIRECT = String(
  process.env.FRONTEND_AUTH_REDIRECT || `${FRONTEND_ORIGIN}/#/`
).trim();
const GOOGLE_OAUTH_ENABLED = Boolean(
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI
);
const googleOAuthClient = GOOGLE_OAUTH_ENABLED
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

// =====================================================================
// GOOGLE OAUTH CONFIGURATION DIAGNOSTICS
// =====================================================================
console.log("\n=== Google OAuth Configuration Check ===");
console.log("1️⃣ Client ID loaded:", process.env.GOOGLE_CLIENT_ID ? "YES" : "NO");
console.log("   - Length:", process.env.GOOGLE_CLIENT_ID?.length || 0);
console.log("   - Ends with .apps.googleusercontent.com:", 
  process.env.GOOGLE_CLIENT_ID?.endsWith(".apps.googleusercontent.com") ? "✅ YES" : "❌ NO"
);
console.log("   - Is placeholder:", 
  process.env.GOOGLE_CLIENT_ID?.includes("your-google") ? "⚠️  YES (MUST REPLACE!)" : "✅ No"
);

console.log("\n2️⃣ Client Secret loaded:", process.env.GOOGLE_CLIENT_SECRET ? "YES" : "NO");
console.log("   - Length:", process.env.GOOGLE_CLIENT_SECRET?.length || 0);
console.log("   - Is placeholder:", 
  process.env.GOOGLE_CLIENT_SECRET?.includes("your-google") ? "⚠️  YES (MUST REPLACE!)" : "✅ No"
);

console.log("\n3️⃣ Redirect URI:", GOOGLE_REDIRECT_URI || "(missing)");
console.log("   - Expected format: http://localhost:8081/auth/google/callback");
console.log("   - Match:", GOOGLE_REDIRECT_URI === "http://localhost:8081/auth/google/callback" ? "✅" : "⚠️");

console.log("\n4️⃣ Frontend Origin:", FRONTEND_ORIGIN);
console.log("   - Expected: http://localhost:5174");

console.log("\n5️⃣ OAuth Enabled:", GOOGLE_OAUTH_ENABLED ? "✅ YES" : "❌ NO");

if (!GOOGLE_OAUTH_ENABLED) {
  console.log("\n⚠️  Google OAuth is DISABLED. Reasons:");
  if (!GOOGLE_CLIENT_ID) console.log("   - Missing GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) console.log("   - Missing GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_REDIRECT_URI) console.log("   - Missing GOOGLE_REDIRECT_URI");
}

if (GOOGLE_CLIENT_ID?.includes("your-google") || GOOGLE_CLIENT_SECRET?.includes("your-google")) {
  console.log("\n❌ CRITICAL ERROR: Placeholder values detected!");
  console.log("   You MUST replace 'your-google-client-id' and 'your-google-client-secret'");
  console.log("   with your actual credentials from Google Cloud Console.");
  console.log("\n   Steps:");
  console.log("   1. Go to: https://console.cloud.google.com/apis/credentials");
  console.log("   2. Create OAuth 2.0 Client ID (Type: Web application)");
  console.log("   3. Add Authorized Redirect URI: http://localhost:8081/auth/google/callback");
  console.log("   4. Add Authorized JavaScript origin: http://localhost:5174");
  console.log("   5. Copy Client ID and Client Secret to .env file");
  console.log("   6. Restart the server");
}

console.log("=======================================\n");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(32));
}

function createCodeChallenge(verifier) {
  const digest = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(digest);
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
    message
  });
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  };
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function runSupabase(promise, label) {
  try {
    return await withTimeout(promise, SUPABASE_TIMEOUT_MS, label);
  } catch (error) {
    console.error(`${label} failed:`, error?.message || error);
    return {
      data: null,
      error: { message: error?.message || `${label} failed` }
    };
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function listLocalUsers() {
  const users = readJSON("users.json");
  return Array.isArray(users) ? users : [];
}

function saveLocalUsers(users) {
  writeJSON("users.json", users);
}

function generateUserCode(users) {
  const used = new Set(
    users
      .map((user) => String(user?.user_code || ""))
      .filter((code) => /^\d{5}$/.test(code))
  );

  for (let i = 0; i < 1000; i += 1) {
    const code = String(10000 + Math.floor(Math.random() * 90000));
    if (!used.has(code)) return code;
  }

  return String((Date.now() % 90000) + 10000).slice(0, 5);
}

// Password hashing using bcrypt (12 rounds = OWASP standard)
// Supports bcrypt hashes and handles legacy scrypt hashes for backward compatibility
async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, 12);
    return hash; // bcrypt format: $2b$12$...
  } catch (error) {
    console.error('Bcrypt hashing failed:', error);
    throw new Error('Password hashing failed');
  }
}

async function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== "string") return false;

  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch (error) {
      console.error('Bcrypt verification failed:', error);
      return false;
    }
  }

  // Backward compatibility: support legacy scrypt hashes
  if (passwordHash.startsWith('scrypt:')) {
    const [algorithm, salt, storedHash] = passwordHash.split(":");
    if (algorithm !== "scrypt" || !salt || !storedHash) return false;

    try {
      const derivedHash = crypto
        .scryptSync(password, salt, storedHash.length / 2)
        .toString("hex");

      const storedBuffer = Buffer.from(storedHash, "hex");
      const derivedBuffer = Buffer.from(derivedHash, "hex");

      if (storedBuffer.length !== derivedBuffer.length) return false;
      return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
    } catch (error) {
      console.error('Scrypt verification failed:', error);
      return false;
    }
  }

  // Unknown format
  return false;
}

function toPublicProfile(record, fallbackEmail = "") {
  const email = normalizeEmail(record?.email || fallbackEmail);
  const safeName =
    record?.name ||
    (email.includes("@") ? email.split("@")[0] : "User");

  return {
    id: record?.id || null,
    email,
    name: safeName,
    role: record?.role || "user",
    avatar_url: record?.avatar_url || null,
    is_private: Boolean(record?.is_private),
    user_code: record?.user_code || null,
    created_at: record?.created_at || null,
    updated_at: record?.updated_at || null
  };
}

function toPublicUser(profile) {
  return {
    id: profile.id,
    email: profile.email
  };
}

function validateCredentials(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "A valid email is required" };
  }

  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters" };
  }

  return { ok: true, email: normalizedEmail };
}

// Login attempt tracking for brute-force protection
function checkLoginLocked(email) {
  const normalizedEmail = normalizeEmail(email);
  const attempt = loginAttempts.get(normalizedEmail);
  
  if (!attempt) return { locked: false };
  if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    return { locked: true, lockedUntilMS: attempt.lockedUntil };
  }
  
  return { locked: false };
}

function recordFailedLogin(email) {
  const normalizedEmail = normalizeEmail(email);
  const attempt = loginAttempts.get(normalizedEmail) || { count: 0, lockedUntil: null };
  
  attempt.count += 1;
  
  // Lock after 3 failed attempts for 15 minutes
  if (attempt.count >= 3) {
    attempt.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  
  loginAttempts.set(normalizedEmail, attempt);
}

function clearFailedLogins(email) {
  const normalizedEmail = normalizeEmail(email);
  loginAttempts.delete(normalizedEmail);
}

const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Try again later." }
});

const signupRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many signup attempts. Try again later." }
});

const refreshRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many refresh requests. Try again later." }
});

// Refresh token management
async function hashToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash;
}

async function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = await hashToken(token);
  return { token, tokenHash };
}

async function storeRefreshToken(userId, tokenHash, expiresAt, req) {
  const createdAt = new Date().toISOString();
  const expiresAtIso = new Date(expiresAt).toISOString();
  const ipAddress = req?.ip || null;
  const userAgent = req?.get?.("user-agent") || null;

  if (hasSupabaseConfig) {
    const { error } = await runSupabase(
      supabase.from("refresh_tokens").insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAtIso,
        created_at: createdAt,
        last_used_at: null,
        revoked_at: null,
        ip_address: ipAddress,
        user_agent: userAgent
      }),
      "Supabase refresh token insert"
    );

    if (error) {
      // Fall back to local storage if table doesn't exist
      console.warn("⚠️  Supabase refresh_tokens table not found, using local storage fallback:", error.message);
      console.warn("   To fix: Run sql/create_refresh_tokens_table.sql in Supabase SQL Editor");
      
      localRefreshTokens.set(tokenHash, {
        userId,
        expiresAt,
        createdAt: Date.now(),
        lastUsedAt: null,
        revokedAt: null,
        ipAddress,
        userAgent
      });
      return;
    }

    return;
  }

  localRefreshTokens.set(tokenHash, {
    userId,
    expiresAt,
    createdAt: Date.now(),
    lastUsedAt: null,
    revokedAt: null,
    ipAddress,
    userAgent
  });
}

async function getRefreshTokenRecord(tokenHash) {
  if (hasSupabaseConfig) {
    const { data, error } = await runSupabase(
      supabase
        .from("refresh_tokens")
        .select("id,user_id,token_hash,expires_at,revoked_at,last_used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle(),
      "Supabase refresh token lookup"
    );

    if (error) {
      console.error("Refresh token lookup failed:", error.message || error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      expiresAt: new Date(data.expires_at).getTime(),
      revokedAt: data.revoked_at ? new Date(data.revoked_at).getTime() : null,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at).getTime() : null
    };
  }

  const token = localRefreshTokens.get(tokenHash);
  if (!token) return null;

  return {
    id: tokenHash,
    userId: token.userId,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt || null,
    lastUsedAt: token.lastUsedAt || null
  };
}

async function markRefreshTokenUsed(tokenHash) {
  if (hasSupabaseConfig) {
    const now = new Date().toISOString();
    await runSupabase(
      supabase
        .from("refresh_tokens")
        .update({ last_used_at: now })
        .eq("token_hash", tokenHash),
      "Supabase refresh token update"
    );
    return;
  }

  const token = localRefreshTokens.get(tokenHash);
  if (token) {
    token.lastUsedAt = Date.now();
    localRefreshTokens.set(tokenHash, token);
  }
}

async function revokeRefreshToken(tokenHash) {
  if (hasSupabaseConfig) {
    const now = new Date().toISOString();
    await runSupabase(
      supabase
        .from("refresh_tokens")
        .update({ revoked_at: now })
        .eq("token_hash", tokenHash),
      "Supabase refresh token revoke"
    );
    return;
  }

  const token = localRefreshTokens.get(tokenHash);
  if (token) {
    token.revokedAt = Date.now();
    localRefreshTokens.set(tokenHash, token);
  }
}

async function revokeUserRefreshTokens(userId) {
  // Revoke all refresh tokens for a user (used during password change, logout all)
  if (hasSupabaseConfig) {
    const now = new Date().toISOString();
    await runSupabase(
      supabase.from("refresh_tokens").update({ revoked_at: now }).eq("user_id", userId),
      "Supabase revoke user refresh tokens"
    );
    return;
  }

  for (const [tokenHash, token] of localRefreshTokens.entries()) {
    if (token.userId === userId) {
      token.revokedAt = Date.now();
      localRefreshTokens.set(tokenHash, token);
    }
  }
}

// Access token session management for local authentication
function createLocalSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  localSessions.set(token, {
    userId,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS
  });
  return token;
}

function getLocalSession(token) {
  const session = localSessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    localSessions.delete(token);
    return null;
  }

  return session;
}

async function getOrCreateSupabaseProfile(authUser, patch = {}) {
  const fallbackEmail = normalizeEmail(patch.email || authUser?.email || "");
  const fallbackName =
    (typeof patch.name === "string" && patch.name.trim()) ||
    authUser?.user_metadata?.name ||
    (fallbackEmail.includes("@") ? fallbackEmail.split("@")[0] : "User");

  const { data: existingProfile, error: profileError } = await runSupabase(
    supabase
      .from("users")
      .select(PROFILE_SELECT)
      .eq("id", authUser.id)
      .maybeSingle(),
    "Supabase profile read"
  );

  if (profileError) {
    throw new Error(profileError.message || "Failed to read profile");
  }

  const now = new Date().toISOString();
  if (!existingProfile) {
    const insertPayload = {
      id: authUser.id,
      email: fallbackEmail || authUser.email || "",
      name: fallbackName,
      role: "user",
      is_private: false,
      updated_at: now
    };

    if (typeof patch.is_private === "boolean") {
      insertPayload.is_private = patch.is_private;
    }

    const { data: createdProfile, error: insertError } = await runSupabase(
      supabase
        .from("users")
        .upsert(insertPayload, { onConflict: "id" })
        .select(PROFILE_SELECT)
        .single(),
      "Supabase profile upsert"
    );

    if (insertError) {
      throw new Error(insertError.message || "Failed to create profile");
    }

    return toPublicProfile(createdProfile, fallbackEmail);
  }

  const updates = { updated_at: now };
  let hasUpdates = false;

  if (typeof patch.name === "string" && patch.name.trim()) {
    const nextName = patch.name.trim();
    if (nextName !== existingProfile.name) {
      updates.name = nextName;
      hasUpdates = true;
    }
  }

  if (typeof patch.email === "string") {
    const nextEmail = normalizeEmail(patch.email);
    if (nextEmail && nextEmail !== normalizeEmail(existingProfile.email)) {
      updates.email = nextEmail;
      hasUpdates = true;
    }
  }

  if (typeof patch.is_private === "boolean") {
    if (patch.is_private !== Boolean(existingProfile.is_private)) {
      updates.is_private = patch.is_private;
      hasUpdates = true;
    }
  }

  if (!hasUpdates) {
    return toPublicProfile(existingProfile, fallbackEmail);
  }

  const { data: updatedProfile, error: updateError } = await runSupabase(
    supabase
      .from("users")
      .update(updates)
      .eq("id", authUser.id)
      .select(PROFILE_SELECT)
      .single(),
    "Supabase profile update"
  );

  if (updateError) {
    throw new Error(updateError.message || "Failed to update profile");
  }

  return toPublicProfile(updatedProfile, fallbackEmail);
}

function ensureLocalUserHasCode(localUser, users) {
  if (localUser.user_code) return;

  localUser.user_code = generateUserCode(users);
  localUser.updated_at = new Date().toISOString();
  saveLocalUsers(users);
}

function findLocalUserByEmail(email) {
  const users = listLocalUsers();
  const localUser = users.find(
    (candidate) => normalizeEmail(candidate.email) === normalizeEmail(email)
  );

  return { users, localUser: localUser || null };
}

async function buildLocalLoginResponse(email, password) {
  const { users, localUser } = findLocalUserByEmail(email);
  if (!localUser) return null;
  if (!(await verifyPassword(password, localUser.passwordHash))) return null;

  ensureLocalUserHasCode(localUser, users);
  const token = createLocalSession(localUser.id);
  const profile = toPublicProfile(localUser, localUser.email);

  return {
    token,
    user: toPublicUser(profile),
    profile
  };
}

async function createLocalUser(email, password, name) {
  const users = listLocalUsers();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );
  if (existingUser) {
    return { ok: false, status: 409, message: "User already exists" };
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    google_id: null,
    auth_provider: "local",
    avatar_url: null,
    role: "user",
    is_private: false,
    user_code: generateUserCode(users),
    passwordHash,
    created_at: now,
    updated_at: now
  };

  users.push(newUser);
  saveLocalUsers(users);

  return {
    ok: true,
    user: { id: newUser.id, email: newUser.email },
    profile: toPublicProfile(newUser, newUser.email)
  };
}

async function resolveOrCreateGoogleUser({ email, name, avatarUrl, googleId }) {
  const normalizedEmail = normalizeEmail(email);
  const safeName =
    (typeof name === "string" && name.trim()) ||
    (normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "User");
  const now = new Date().toISOString();

  if (hasSupabaseConfig) {
    const { data: googleMatch, error: googleError } = await runSupabase(
      supabase.from("users").select(PROFILE_SELECT).eq("google_id", googleId).maybeSingle(),
      "Supabase Google user lookup"
    );
    if (googleError) {
      return { ok: false, status: 500, message: googleError.message || "Failed to lookup user" };
    }

    if (googleMatch) {
      return {
        ok: true,
        userId: googleMatch.id,
        profile: toPublicProfile(googleMatch, normalizedEmail)
      };
    }

    const { data: emailMatch, error: emailError } = await runSupabase(
      supabase.from("users").select(PROFILE_SELECT).eq("email", normalizedEmail).maybeSingle(),
      "Supabase email lookup"
    );
    if (emailError) {
      return { ok: false, status: 500, message: emailError.message || "Failed to lookup user" };
    }

    if (emailMatch) {
      if (emailMatch.google_id && emailMatch.google_id !== googleId) {
        return { ok: false, status: 409, message: "Email already linked to another Google account" };
      }

      const updates = {
        google_id: googleId,
        auth_provider: "google",
        updated_at: now
      };

      if (avatarUrl && !emailMatch.avatar_url) {
        updates.avatar_url = avatarUrl;
      }

      if (safeName && safeName !== emailMatch.name) {
        updates.name = safeName;
      }

      const { data: updated, error: updateError } = await runSupabase(
        supabase
          .from("users")
          .update(updates)
          .eq("id", emailMatch.id)
          .select(PROFILE_SELECT)
          .single(),
        "Supabase link Google account"
      );

      if (updateError) {
        return { ok: false, status: 400, message: updateError.message || "Failed to link account" };
      }

      return {
        ok: true,
        userId: updated.id,
        profile: toPublicProfile(updated, normalizedEmail)
      };
    }

    const userId = crypto.randomUUID();
    const insertPayload = {
      id: userId,
      email: normalizedEmail,
      name: safeName,
      role: "user",
      is_private: false,
      google_id: googleId,
      auth_provider: "google",
      avatar_url: avatarUrl || null,
      created_at: now,
      updated_at: now
    };

    const { data: created, error: insertError } = await runSupabase(
      supabase.from("users").insert(insertPayload).select(PROFILE_SELECT).single(),
      "Supabase create Google user"
    );

    if (insertError) {
      return { ok: false, status: 400, message: insertError.message || "Failed to create user" };
    }

    return {
      ok: true,
      userId: created.id,
      profile: toPublicProfile(created, normalizedEmail)
    };
  }

  const users = listLocalUsers();
  let localUser = users.find((candidate) => candidate.google_id === googleId);

  if (localUser) {
    let changed = false;
    if (normalizedEmail && normalizeEmail(localUser.email) !== normalizedEmail) {
      localUser.email = normalizedEmail;
      changed = true;
    }
    if (safeName && localUser.name !== safeName) {
      localUser.name = safeName;
      changed = true;
    }
    if (avatarUrl && localUser.avatar_url !== avatarUrl) {
      localUser.avatar_url = avatarUrl;
      changed = true;
    }
    if (localUser.auth_provider !== "google") {
      localUser.auth_provider = "google";
      changed = true;
    }

    if (changed) {
      localUser.updated_at = now;
      saveLocalUsers(users);
    }

    return {
      ok: true,
      userId: localUser.id,
      profile: toPublicProfile(localUser, normalizedEmail)
    };
  }

  localUser = users.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );

  if (localUser) {
    if (localUser.google_id && localUser.google_id !== googleId) {
      return { ok: false, status: 409, message: "Email already linked to another Google account" };
    }

    localUser.google_id = googleId;
    localUser.auth_provider = "google";
    if (safeName && localUser.name !== safeName) {
      localUser.name = safeName;
    }
    if (avatarUrl) {
      localUser.avatar_url = avatarUrl;
    }
    localUser.updated_at = now;
    saveLocalUsers(users);

    return {
      ok: true,
      userId: localUser.id,
      profile: toPublicProfile(localUser, normalizedEmail)
    };
  }

  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: safeName,
    google_id: googleId,
    auth_provider: "google",
    avatar_url: avatarUrl || null,
    role: "user",
    is_private: false,
    user_code: generateUserCode(users),
    passwordHash: null,
    created_at: now,
    updated_at: now
  };

  users.push(newUser);
  saveLocalUsers(users);

  return {
    ok: true,
    userId: newUser.id,
    profile: toPublicProfile(newUser, normalizedEmail)
  };
}

async function resolveAuth(req) {
  // First try to get token from cookies (httpOnly cookie-based auth)
  // Fall back to Bearer token header for backward compatibility
  const token = req.cookies?.accessToken || getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "No authorization token provided" };
  }

  if (hasSupabaseConfig) {
    const authResult = await runSupabase(
      supabase.auth.getUser(token),
      "Supabase auth.getUser"
    );
    const authUser = authResult?.data?.user || null;
    const authError = authResult?.error || null;

    if (!authError && authUser) {
      let profile;
      try {
        profile = await getOrCreateSupabaseProfile(authUser, {
          email: authUser.email
        });
      } catch (profileError) {
        console.error("Auth profile sync failed:", profileError.message);
        profile = toPublicProfile(
          { id: authUser.id, email: authUser.email, name: authUser.user_metadata?.name },
          authUser.email
        );
      }

      return {
        ok: true,
        token,
        authUser,
        user: toPublicUser(profile),
        profile
      };
    }
  }

  const session = getLocalSession(token);
  if (!session) {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }

  const users = listLocalUsers();
  const localUser = users.find((candidate) => candidate.id === session.userId);
  if (!localUser) {
    localSessions.delete(token);
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }

  ensureLocalUserHasCode(localUser, users);

  const profile = toPublicProfile(localUser, localUser.email);
  return {
    ok: true,
    token,
    localUser,
    user: toPublicUser(profile),
    profile
  };
}

router.get("/google", (req, res) => {
  if (!GOOGLE_OAUTH_ENABLED) {
    return sendError(res, 500, "Google OAuth is not configured");
  }

  const state = base64UrlEncode(crypto.randomBytes(16));
  const verifier = createCodeVerifier();
  const challenge = createCodeChallenge(verifier);

  res.cookie("google_oauth_state", state, cookieOptions(10 * 60 * 1000));
  res.cookie("google_oauth_verifier", verifier, cookieOptions(10 * 60 * 1000));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  try {
    if (!GOOGLE_OAUTH_ENABLED || !googleOAuthClient) {
      return sendError(res, 500, "Google OAuth is not configured");
    }

    const { code, state } = req.query || {};
    const storedState = req.cookies?.google_oauth_state;
    const verifier = req.cookies?.google_oauth_verifier;

    res.clearCookie("google_oauth_state", { path: "/" });
    res.clearCookie("google_oauth_verifier", { path: "/" });

    if (!code || !state || !storedState || state !== storedState || !verifier) {
      return sendError(res, 401, "Invalid OAuth state");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: verifier
      })
    });

    if (!tokenResponse.ok) {
      const errorPayload = await tokenResponse.text();
      console.error("Google token exchange failed:", errorPayload);
      return sendError(res, 401, "Failed to exchange Google OAuth code");
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData?.id_token;

    if (!idToken) {
      return sendError(res, 401, "Missing Google ID token");
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.email_verified) {
      return sendError(res, 401, "Google account email not verified");
    }

    const googleUser = {
      email: payload.email,
      name: payload.name || payload.given_name || payload.email,
      avatarUrl: payload.picture || null,
      googleId: payload.sub
    };

    const resolved = await resolveOrCreateGoogleUser(googleUser);
    if (!resolved.ok) {
      return sendError(res, resolved.status || 400, resolved.message || "Google login failed");
    }

    const accessToken = createLocalSession(resolved.userId);
    const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
    const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await storeRefreshToken(resolved.userId, refreshTokenHash, refreshExpiresAt, req);

    res.cookie("accessToken", accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));
    res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

    return res.redirect(FRONTEND_AUTH_REDIRECT);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return sendError(res, 500, "Google login failed");
  }
});

router.post("/signup", signupRateLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const credentials = validateCredentials(email, password);

    if (!credentials.ok) {
      return sendError(res, 400, credentials.message);
    }

    const displayName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : credentials.email.split("@")[0];

    if (hasSupabaseConfig) {
      const { data, error } = await runSupabase(
        supabase.auth.signUp({
          email: credentials.email,
          password,
          options: {
            data: { name: displayName }
          }
        }),
        "Supabase signUp"
      );

      if (!error && data?.user?.id) {
        const authUser = data.user;
        let profile = null;
        try {
          profile = await getOrCreateSupabaseProfile(authUser, {
            email: credentials.email,
            name: displayName
          });
        } catch (profileError) {
          console.error("Profile creation warning:", profileError.message);
        }

        // Set access token cookie for Supabase (if it provides a session)
        if (data?.session?.access_token) {
          res.cookie("accessToken", data.session.access_token, cookieOptions(ACCESS_TOKEN_TTL_MS));

          // Generate and set refresh token
          const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
          const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
          await storeRefreshToken(authUser.id, refreshTokenHash, refreshExpiresAt, req);
          
          res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));
        }

        return res.status(201).json({
          success: true,
          message: "Account created successfully",
          token: data?.session?.access_token || null,
          user: authUser
            ? { id: authUser.id, email: authUser.email || credentials.email }
            : null,
          profile
        });
      }

      // Supabase signup failed; fall back to local dev auth so app remains usable.
      const localCreate = await createLocalUser(credentials.email, password, displayName);
      if (!localCreate.ok) {
        return sendError(res, localCreate.status, localCreate.message);
      }

      // Create session token for the new user
      const accessToken = createLocalSession(localCreate.user.id);

      // Set cookies for local signup
      res.cookie("accessToken", accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));

      // Generate and set refresh token
      const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
      const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
      await storeRefreshToken(localCreate.user.id, refreshTokenHash, refreshExpiresAt, req);
      
      res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        token: accessToken,
        user: localCreate.user,
        profile: localCreate.profile
      });
    }

    // Local-only signup path
    const localCreate = await createLocalUser(credentials.email, password, displayName);
    if (!localCreate.ok) {
      return sendError(res, localCreate.status, localCreate.message);
    }

    // Create session token for the new user
    const accessToken = createLocalSession(localCreate.user.id);

    // Set cookies
    res.cookie("accessToken", accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));

    // Generate and set refresh token
    const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
    const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await storeRefreshToken(localCreate.user.id, refreshTokenHash, refreshExpiresAt, req);

    res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token: accessToken,
      user: localCreate.user,
      profile: localCreate.profile
    });
  } catch (error) {
    console.error("Signup route error:", error);
    return sendError(res, 500, "Signup failed");
  }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    // Log login attempt and env info BEFORE Supabase call
    console.log("LOGIN ATTEMPT:", {
      email,
      supabaseUrl: process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_KEY
    });
    const credentials = validateCredentials(email, password);

    if (!credentials.ok) {
      // Generic error message - never reveal if email exists
      return sendError(res, 400, "Invalid credentials");
    }

    // Check if account is locked due to failed attempts
    const lockStatus = checkLoginLocked(credentials.email);
    if (lockStatus.locked) {
      return sendError(res, 429, "Too many failed attempts. Please try again later.");
    }

    if (hasSupabaseConfig) {
      const { data, error } = await runSupabase(
        supabase.auth.signInWithPassword({
          email: credentials.email,
          password
        }),
        "Supabase signInWithPassword"
      );
      // Log the FULL Supabase response
      console.log("SUPABASE RESPONSE:", { data, error });

      if (!error && data?.session?.access_token && data?.user) {
        let profile;
        try {
          profile = await getOrCreateSupabaseProfile(data.user, {
            email: credentials.email
          });
        } catch (profileError) {
          console.error("Profile lookup warning:", profileError.message);
          profile = toPublicProfile(
            {
              id: data.user.id,
              email: data.user.email || credentials.email,
              name: data.user.user_metadata?.name
            },
            data.user.email || credentials.email
          );
        }

        // Success: clear failed attempts and set cookies
        clearFailedLogins(credentials.email);
        
        // Set access token in httpOnly cookie
        res.cookie("accessToken", data.session.access_token, cookieOptions(ACCESS_TOKEN_TTL_MS));

        // Generate and set refresh token
        const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
        const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
        await storeRefreshToken(data.user.id, refreshTokenHash, refreshExpiresAt, req);
        
        res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

        // Return user/profile and token in body (for mobile clients)
        return res.json({
          success: true,
          token: data.session.access_token,
          user: toPublicUser(profile),
          profile
        });
      }

      // Supabase failed, try local dev auth
      const localLogin = await buildLocalLoginResponse(credentials.email, password);
      if (localLogin) {
        // Success: clear failed attempts and set cookies
        clearFailedLogins(credentials.email);

        // Set access token in httpOnly cookie
        res.cookie("accessToken", localLogin.token, cookieOptions(ACCESS_TOKEN_TTL_MS));

        // Generate and set refresh token
        const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
        const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
        await storeRefreshToken(localLogin.user.id, refreshTokenHash, refreshExpiresAt, req);

        res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

        return res.json({
          success: true,
          token: localLogin.token,
          user: localLogin.user,
          profile: localLogin.profile
        });
      }

      // Generic error - never say "password wrong" or "user not found"
      recordFailedLogin(credentials.email);
      return sendError(res, 401, "Invalid credentials");
    }

    // Local auth path
    const localLogin = await buildLocalLoginResponse(credentials.email, password);
    if (!localLogin) {
      recordFailedLogin(credentials.email);
      return sendError(res, 401, "Invalid credentials");
    }

    // Success: clear failed attempts and set cookies
    clearFailedLogins(credentials.email);
    
    // Set access token in httpOnly cookie
    res.cookie("accessToken", localLogin.token, cookieOptions(ACCESS_TOKEN_TTL_MS));

    // Generate and set refresh token
    const { token: refreshToken, tokenHash: refreshTokenHash } = await generateRefreshToken();
    const refreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await storeRefreshToken(localLogin.user.id, refreshTokenHash, refreshExpiresAt, req);
    
    res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

    // Return user/profile and token in body (for mobile clients)
    return res.json({
      success: true,
      token: localLogin.token,
      user: localLogin.user,
      profile: localLogin.profile
    });
  } catch (error) {
    console.error("Login route error:", error);
    return sendError(res, 500, "Login failed");
  }
});

router.post("/refresh", refreshRateLimiter, async (req, res) => {
  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, 401, "Refresh token missing");
    }

    // Hash the token to look it up
    const tokenHash = await hashToken(refreshToken);
    const tokenRecord = await getRefreshTokenRecord(tokenHash);

    if (!tokenRecord) {
      return sendError(res, 401, "Invalid or expired refresh token");
    }

    if (tokenRecord.revokedAt) {
      await revokeUserRefreshTokens(tokenRecord.userId);
      return sendError(res, 401, "Refresh token reuse detected. Please log in again.");
    }

    if (tokenRecord.expiresAt <= Date.now()) {
      await revokeRefreshToken(tokenHash);
      return sendError(res, 401, "Invalid or expired refresh token");
    }

    await markRefreshTokenUsed(tokenHash);

    let user = null;
    if (hasSupabaseConfig) {
      const { data, error } = await runSupabase(
        supabase.from("users").select(PROFILE_SELECT).eq("id", tokenRecord.userId).maybeSingle(),
        "Supabase refresh user lookup"
      );
      if (error || !data) {
        await revokeRefreshToken(tokenHash);
        return sendError(res, 401, "User not found");
      }
      user = data;
    } else {
      const users = listLocalUsers();
      user = users.find(u => u.id === tokenRecord.userId);
      if (!user) {
        await revokeRefreshToken(tokenHash);
        return sendError(res, 401, "User not found");
      }
    }

    // Generate new access token
    const newAccessToken = createLocalSession(tokenRecord.userId);

    // Rotate refresh token and revoke old session
    await revokeRefreshToken(tokenHash);
    const { token: newRefreshToken, tokenHash: newRefreshTokenHash } = await generateRefreshToken();
    const newRefreshExpiresAt = Date.now() + REFRESH_TOKEN_TTL_MS;
    await storeRefreshToken(tokenRecord.userId, newRefreshTokenHash, newRefreshExpiresAt, req);

    // Set new tokens in httpOnly cookies
    res.cookie("accessToken", newAccessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));
    res.cookie("refreshToken", newRefreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));

    const profile = toPublicProfile(user, user.email);
    return res.json({
      success: true,
      user: toPublicUser(profile),
      profile
    });
  } catch (error) {
    console.error("Refresh token route error:", error);
    return sendError(res, 500, "Token refresh failed");
  }
});

router.get("/me", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) {
      return sendError(res, auth.status, auth.message);
    }

    return res.json({
      success: true,
      user: auth.user,
      profile: auth.profile
    });
  } catch (error) {
    console.error("Auth /me route error:", error);
    return sendError(res, 500, "Failed to load user");
  }
});

router.get("/profile", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) {
      return sendError(res, auth.status, auth.message);
    }

    return res.json({
      success: true,
      user: auth.user,
      profile: auth.profile
    });
  } catch (error) {
    console.error("Auth /profile route error:", error);
    return sendError(res, 500, "Failed to load profile");
  }
});

router.put("/profile", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) {
      return sendError(res, auth.status, auth.message);
    }

    const { name, email, is_private: isPrivate } = req.body || {};

    if (hasSupabaseConfig) {
      const normalizedEmail = normalizeEmail(email || auth.user.email);
      const normalizedName =
        (typeof name === "string" && name.trim()) ||
        auth.profile.name ||
        (normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "User");

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return sendError(res, 400, "A valid email is required");
      }

      const profilePayload = {
        id: auth.authUser.id,
        email: normalizedEmail,
        name: normalizedName,
        updated_at: new Date().toISOString()
      };

      if (typeof isPrivate === "boolean") {
        profilePayload.is_private = isPrivate;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("users")
        .upsert(profilePayload, { onConflict: "id" })
        .select(PROFILE_SELECT)
        .single();

      if (updateError) {
        return sendError(res, 400, updateError.message || "Failed to update profile");
      }

      const profile = toPublicProfile(updatedProfile, normalizedEmail);
      return res.json({
        success: true,
        user: toPublicUser(profile),
        profile
      });
    }

    const users = listLocalUsers();
    const localUserIndex = users.findIndex((candidate) => candidate.id === auth.localUser.id);
    if (localUserIndex < 0) {
      return sendError(res, 404, "User not found");
    }

    const localUser = users[localUserIndex];
    let changed = false;

    if (typeof name === "string" && name.trim()) {
      localUser.name = name.trim();
      changed = true;
    }

    if (typeof email === "string") {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return sendError(res, 400, "A valid email is required");
      }

      const emailInUse = users.some(
        (candidate) =>
          candidate.id !== localUser.id &&
          normalizeEmail(candidate.email) === normalizedEmail
      );
      if (emailInUse) {
        return sendError(res, 409, "Email is already in use");
      }

      localUser.email = normalizedEmail;
      changed = true;
    }

    if (typeof isPrivate === "boolean") {
      localUser.is_private = isPrivate;
      changed = true;
    }

    ensureLocalUserHasCode(localUser, users);

    if (changed) {
      localUser.updated_at = new Date().toISOString();
      saveLocalUsers(users);
    }

    const profile = toPublicProfile(localUser, localUser.email);
    return res.json({
      success: true,
      user: toPublicUser(profile),
      profile
    });
  } catch (error) {
    console.error("Auth /profile update error:", error);
    return sendError(res, 500, "Failed to update profile");
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.accessToken || getBearerToken(req);
  const refreshToken = req.cookies?.refreshToken;

  // Clear access token from memory
  if (token) {
    localSessions.delete(token);
  }

  // Invalidate refresh token if present
  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken);
    await revokeRefreshToken(tokenHash);
  }

  // Clear cookies
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });

  return res.json({
    success: true,
    message: "Logged out"
  });
});

router.put("/password", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) return sendError(res, auth.status, auth.message);

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, "currentPassword and newPassword are required");
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return sendError(res, 400, "New password must be at least 6 characters");
    }

    if (hasSupabaseConfig && auth.authUser) {
      // Verify current password via re-auth
      const { error: signInError } = await runSupabase(
        supabase.auth.signInWithPassword({
          email: auth.user.email,
          password: currentPassword
        }),
        "Supabase verify current password"
      );
      if (signInError) return sendError(res, 401, "Current password is incorrect");

      // Update password via admin API
      const { error: updateError } = await runSupabase(
        supabase.auth.admin.updateUserById(auth.authUser.id, { password: newPassword }),
        "Supabase update password"
      );
      if (updateError) return sendError(res, 400, updateError.message || "Failed to update password");

      // Invalidate all refresh tokens (forces re-login on all devices)
      await revokeUserRefreshTokens(auth.authUser.id);
      
      // Clear refresh token cookie
      res.clearCookie("refreshToken", { path: "/" });

      return res.json({ success: true, message: "Password updated successfully" });
    }

    // Local auth path
    const users = listLocalUsers();
    const idx = users.findIndex((u) => u.id === auth.localUser.id);
    if (idx < 0) return sendError(res, 404, "User not found");

    if (!(await verifyPassword(currentPassword, users[idx].passwordHash))) {
      return sendError(res, 401, "Current password is incorrect");
    }

    users[idx].passwordHash = await hashPassword(newPassword);
    users[idx].updated_at = new Date().toISOString();
    saveLocalUsers(users);

    // Invalidate all refresh tokens for this user (forces re-login on all devices)
    await revokeUserRefreshTokens(auth.localUser.id);
    
    // Clear refresh token cookie
    res.clearCookie("refreshToken", { path: "/" });

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Auth /password error:", error);
    return sendError(res, 500, "Failed to update password");
  }
});

router.get("/account/export", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) return sendError(res, auth.status, auth.message);

    const exportPayload = {
      generated_at: new Date().toISOString(),
      user: auth.profile || auth.user || null,
      data: {},
      warnings: []
    };

    if (hasSupabaseConfig && auth.authUser) {
      const userId = auth.authUser.id;

      const queries = await Promise.allSettled([
        runSupabase(
          supabase.from("users").select(PROFILE_SELECT).eq("id", userId).maybeSingle(),
          "Export user profile"
        ),
        runSupabase(
          supabase.from("dish_ratings").select("id,menu_item_id,restaurant_id,rating,comment,created_at").eq("user_id", userId),
          "Export dish ratings"
        ),
        runSupabase(
          supabase.from("menu_item_flags").select("*").eq("reported_by", userId),
          "Export menu item flags"
        ),
        runSupabase(
          supabase.from("review_reports").select("*").eq("reported_by", userId),
          "Export review reports"
        ),
        runSupabase(
          supabase.from("follows").select("follower_id,following_id,created_at").or(`follower_id.eq.${userId},following_id.eq.${userId}`),
          "Export follows"
        ),
        runSupabase(
          supabase.from("follow_requests").select("requester_id,recipient_id,status,created_at").or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
          "Export follow requests"
        )
      ]);

      const [profileRes, ratingsRes, flagsRes, reportsRes, followsRes, requestsRes] = queries;

      if (profileRes.status === "fulfilled" && !profileRes.value?.error) {
        exportPayload.data.profile = profileRes.value?.data || null;
      } else {
        exportPayload.warnings.push("Profile export failed");
      }

      if (ratingsRes.status === "fulfilled" && !ratingsRes.value?.error) {
        exportPayload.data.dish_ratings = ratingsRes.value?.data || [];
      } else {
        exportPayload.warnings.push("Dish ratings export failed");
      }

      if (flagsRes.status === "fulfilled" && !flagsRes.value?.error) {
        exportPayload.data.menu_item_flags = flagsRes.value?.data || [];
      } else if (flagsRes.status === "fulfilled" && flagsRes.value?.error) {
        exportPayload.warnings.push("Menu item flags export failed");
      }

      if (reportsRes.status === "fulfilled" && !reportsRes.value?.error) {
        exportPayload.data.review_reports = reportsRes.value?.data || [];
      } else if (reportsRes.status === "fulfilled" && reportsRes.value?.error) {
        exportPayload.warnings.push("Review reports export failed");
      }

      if (followsRes.status === "fulfilled" && !followsRes.value?.error) {
        exportPayload.data.follows = followsRes.value?.data || [];
      } else {
        exportPayload.warnings.push("Follows export failed");
      }

      if (requestsRes.status === "fulfilled" && !requestsRes.value?.error) {
        exportPayload.data.follow_requests = requestsRes.value?.data || [];
      } else {
        exportPayload.warnings.push("Follow requests export failed");
      }
    } else if (auth.localUser) {
      exportPayload.data.profile = auth.profile || null;
      exportPayload.warnings.push("Supabase not configured; export is limited to local profile data.");
    }

    return res.json(exportPayload);
  } catch (error) {
    console.error("Auth /account export error:", error);
    return sendError(res, 500, "Failed to export account data");
  }
});

router.delete("/account", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) return sendError(res, auth.status, auth.message);

    if (hasSupabaseConfig && auth.authUser) {
      const { error } = await runSupabase(
        supabase.auth.admin.deleteUser(auth.authUser.id),
        "Supabase delete user"
      );
      if (error) return sendError(res, 400, error.message || "Failed to delete account");
      return res.json({ success: true, message: "Account deleted" });
    }

    // Local auth path
    const users = listLocalUsers();
    const filtered = users.filter((u) => u.id !== auth.localUser.id);
    if (filtered.length === users.length) return sendError(res, 404, "User not found");
    saveLocalUsers(filtered);

    return res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error("Auth /account delete error:", error);
    return sendError(res, 500, "Failed to delete account");
  }
});

export { resolveAuth };
export default router;

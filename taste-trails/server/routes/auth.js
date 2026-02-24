import express from "express";
import crypto from "crypto";
import { supabase } from "../../backend/supabase.js";
import { readJSON, writeJSON } from "../../backend/utils/localDB.js";

const router = express.Router();
const LOCAL_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const localSessions = new Map();
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
  "id,email,name,role,is_private,user_code,created_at,updated_at";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
    message
  });
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== "string") return false;

  const [algorithm, salt, storedHash] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const derivedHash = crypto
    .scryptSync(password, salt, storedHash.length / 2)
    .toString("hex");

  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedBuffer = Buffer.from(derivedHash, "hex");

  if (storedBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
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

function createLocalSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  localSessions.set(token, {
    userId,
    expiresAt: Date.now() + LOCAL_SESSION_TTL_MS
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

function buildLocalLoginResponse(email, password) {
  const { users, localUser } = findLocalUserByEmail(email);
  if (!localUser) return null;
  if (!verifyPassword(password, localUser.passwordHash)) return null;

  ensureLocalUserHasCode(localUser, users);
  const token = createLocalSession(localUser.id);
  const profile = toPublicProfile(localUser, localUser.email);

  return {
    token,
    user: toPublicUser(profile),
    profile
  };
}

function createLocalUser(email, password, name) {
  const users = listLocalUsers();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );
  if (existingUser) {
    return { ok: false, status: 409, message: "User already exists" };
  }

  const now = new Date().toISOString();
  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    role: "user",
    is_private: false,
    user_code: generateUserCode(users),
    passwordHash: hashPassword(password),
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

async function resolveAuth(req) {
  const token = getBearerToken(req);
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

router.post("/signup", async (req, res) => {
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

        return res.status(201).json({
          success: true,
          message: "Account created successfully",
          user: authUser
            ? { id: authUser.id, email: authUser.email || credentials.email }
            : null,
          profile
        });
      }

      // Supabase signup failed; fall back to local dev auth so app remains usable.
      const localCreate = createLocalUser(credentials.email, password, displayName);
      if (!localCreate.ok) {
        return sendError(res, localCreate.status, localCreate.message);
      }

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        user: localCreate.user,
        profile: localCreate.profile
      });
    }

    const localCreate = createLocalUser(credentials.email, password, displayName);
    if (!localCreate.ok) {
      return sendError(res, localCreate.status, localCreate.message);
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: localCreate.user,
      profile: localCreate.profile
    });
  } catch (error) {
    console.error("Signup route error:", error);
    return sendError(res, 500, "Signup failed");
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const credentials = validateCredentials(email, password);

    if (!credentials.ok) {
      return sendError(res, 400, credentials.message);
    }

    if (hasSupabaseConfig) {
      const { data, error } = await runSupabase(
        supabase.auth.signInWithPassword({
          email: credentials.email,
          password
        }),
        "Supabase signInWithPassword"
      );

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

        return res.json({
          success: true,
          token: data.session.access_token,
          user: toPublicUser(profile),
          profile
        });
      }

      // Supabase login failed; try local dev auth before returning an error.
      const localLogin = buildLocalLoginResponse(credentials.email, password);
      if (localLogin) {
        return res.json({
          success: true,
          token: localLogin.token,
          user: localLogin.user,
          profile: localLogin.profile
        });
      }

      return sendError(res, 401, error?.message || "Invalid email or password");
    }

    const localLogin = buildLocalLoginResponse(credentials.email, password);
    if (!localLogin) {
      return sendError(res, 401, "Invalid email or password");
    }

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
  const token = getBearerToken(req);

  if (token) {
    localSessions.delete(token);
  }

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

      return res.json({ success: true, message: "Password updated successfully" });
    }

    // Local auth path
    const users = listLocalUsers();
    const idx = users.findIndex((u) => u.id === auth.localUser.id);
    if (idx < 0) return sendError(res, 404, "User not found");

    if (!verifyPassword(currentPassword, users[idx].passwordHash)) {
      return sendError(res, 401, "Current password is incorrect");
    }

    users[idx].passwordHash = hashPassword(newPassword);
    users[idx].updated_at = new Date().toISOString();
    saveLocalUsers(users);

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Auth /password error:", error);
    return sendError(res, 500, "Failed to update password");
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

const PRIVATE_PROFILES_KEY = "taste-trails-private-profiles";

function safeParseJSON(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getActiveProfileId() {
  if (typeof localStorage === "undefined") return "guest";
  const profile = safeParseJSON(localStorage.getItem("user_profile"), null);
  return String(profile?.id || "guest");
}

export function getUserScopedKey(baseKey, profileId = getActiveProfileId()) {
  return `${baseKey}:${String(profileId || "guest")}`;
}

export function loadUserScopedValue(baseKey, fallback, profileId = getActiveProfileId()) {
  if (typeof localStorage === "undefined") return fallback;
  const scopedKey = getUserScopedKey(baseKey, profileId);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw !== null) return safeParseJSON(scopedRaw, fallback);
  return fallback;
}

export function saveUserScopedValue(baseKey, value, profileId = getActiveProfileId()) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(getUserScopedKey(baseKey, profileId), JSON.stringify(value));
}

export function removeUserScopedValue(baseKey, profileId = getActiveProfileId()) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(getUserScopedKey(baseKey, profileId));
}

export function getPrivateProfilesMap() {
  if (typeof localStorage === "undefined") return {};
  const raw = localStorage.getItem(PRIVATE_PROFILES_KEY);
  const parsed = safeParseJSON(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

export function setPrivateProfileForUser(userId, isPrivate) {
  if (typeof localStorage === "undefined" || !userId) return;
  const key = String(userId);
  const map = getPrivateProfilesMap();
  map[key] = Boolean(isPrivate);
  localStorage.setItem(PRIVATE_PROFILES_KEY, JSON.stringify(map));
}

export function getPrivateProfileForUser(userId) {
  if (!userId) return undefined;
  const map = getPrivateProfilesMap();
  if (!Object.prototype.hasOwnProperty.call(map, String(userId))) return undefined;
  return Boolean(map[String(userId)]);
}

export function resolveThemeMode(preference = "light") {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return "light";
}

export function applyThemeToDocument(preference = "light") {
  if (typeof document === "undefined") return "light";
  const mode = resolveThemeMode(preference);
  const dark = mode === "dark";
  document.documentElement.dataset.theme = mode;
  const background = dark ? "#111111" : "#ffffff";
  document.documentElement.style.background = background;
  document.body.style.background = background;
  document.body.style.color = dark ? "#f3f4f6" : "#111827";
  const root = document.getElementById("root");
  if (root) root.style.background = background;
  return mode;
}

const BASE_URL = process.env.AUTH_TEST_BASE_URL || "http://localhost:8081";

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCookies(setCookieHeaders) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      cookies[name] = value;
    }
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function run() {
  const email = `security_${Date.now()}@example.com`;
  const password = "SecureTest123";

  console.log("=== AUTH SECURITY TESTS ===");
  console.log(`Base URL: ${BASE_URL}`);

  const signup = await requestJson("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Security Test" })
  });
  console.log("Signup status:", signup.response.status);

  const signupCookies = parseCookies(getSetCookieHeaders(signup.response.headers));
  const accessToken = signupCookies.accessToken;
  const refreshToken = signupCookies.refreshToken;

  console.log("Access token cookie present:", !!accessToken);
  console.log("Refresh token cookie present:", !!refreshToken);

  const me = await requestJson("/auth/me", {
    method: "GET",
    headers: { cookie: cookieHeader(signupCookies) }
  });
  console.log("/auth/me status:", me.response.status);

  const badLogin = await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "WrongPass123" })
  });
  console.log("Bad login status:", badLogin.response.status);
  console.log("Bad login message:", badLogin.data?.message || badLogin.data?.error || badLogin.data?.raw);

  const refresh = await requestJson("/auth/refresh", {
    method: "POST",
    headers: { cookie: cookieHeader(signupCookies) }
  });
  console.log("Refresh status:", refresh.response.status);

  const refreshCookies = parseCookies(getSetCookieHeaders(refresh.response.headers));
  const newRefreshToken = refreshCookies.refreshToken || refreshToken;

  const reuse = await requestJson("/auth/refresh", {
    method: "POST",
    headers: { cookie: `refreshToken=${refreshToken}` }
  });
  console.log("Refresh reuse status:", reuse.response.status);
  console.log("Refresh reuse response:", reuse.data?.message || reuse.data?.error || reuse.data?.raw);

  const logout = await requestJson("/auth/logout", {
    method: "POST",
    headers: { cookie: cookieHeader({ refreshToken: newRefreshToken, accessToken }) }
  });
  console.log("Logout status:", logout.response.status);

  const meAfterLogout = await requestJson("/auth/me", {
    method: "GET",
    headers: { cookie: cookieHeader({ accessToken }) }
  });
  console.log("/auth/me after logout status:", meAfterLogout.response.status);

  const corsCheck = await fetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Origin: "http://localhost:5174" }
  });
  console.log("CORS allow-origin:", corsCheck.headers.get("access-control-allow-origin"));
  console.log("CORS allow-credentials:", corsCheck.headers.get("access-control-allow-credentials"));

  console.log("=== TESTS COMPLETE ===");
}

run().catch((error) => {
  console.error("Security tests failed:", error);
  process.exit(1);
});

import autocannon from "autocannon";

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

async function jsonRequest(path, body, headers = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { response, data, headers: response.headers };
}

async function runAutocannon(title, options) {
  console.log(`\n=== ${title} ===`);
  const result = await autocannon(options);
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Average latency: ${Math.round(result.latency.average)} ms`);
  console.log(`Errors: ${result.errors}`);
  return result;
}

async function run() {
  const email = `load_${Date.now()}@example.com`;
  const password = "LoadTest123";

  console.log("Preparing auth load test user...");
  await jsonRequest("/auth/signup", { email, password, name: "Load Test" });
  const login = await jsonRequest("/auth/login", { email, password });

  const cookies = parseCookies(getSetCookieHeaders(login.headers));
  const accessToken = cookies.accessToken;
  const refreshToken = cookies.refreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error("Failed to obtain auth cookies for load test");
  }

  await runAutocannon("200 concurrent logins", {
    url: `${BASE_URL}/auth/login`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    connections: 200,
    duration: 10
  });

  await runAutocannon("200 concurrent refresh", {
    url: `${BASE_URL}/auth/refresh`,
    method: "POST",
    headers: { cookie: `refreshToken=${refreshToken}` },
    connections: 200,
    duration: 10
  });

  await runAutocannon("500 concurrent /auth/me", {
    url: `${BASE_URL}/auth/me`,
    method: "GET",
    headers: { cookie: `accessToken=${accessToken}` },
    connections: 500,
    duration: 10
  });
}

run().catch((error) => {
  console.error("Load test failed:", error);
  process.exit(1);
});

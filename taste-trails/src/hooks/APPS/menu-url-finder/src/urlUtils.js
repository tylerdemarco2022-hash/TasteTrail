const { URL } = require("url");

function normalizeUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Remove hash
    parsedUrl.hash = "";

    // Remove tracking parameters
    const params = parsedUrl.searchParams;
    [...params.keys()].forEach((key) => {
      if (key.startsWith("utm_") || ["gclid", "fbclid"].includes(key)) {
        params.delete(key);
      }
    });

    // Normalize trailing slash
    if (parsedUrl.pathname !== "/" && parsedUrl.pathname.endsWith("/")) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }

    // Lowercase hostname
    parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

    return parsedUrl.toString();
  } catch (err) {
    return url; // Return original URL if parsing fails
  }
}

module.exports = { normalizeUrl };
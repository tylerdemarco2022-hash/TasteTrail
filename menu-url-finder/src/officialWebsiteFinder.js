const axios = require("axios");

async function findOfficialWebsiteSerpApi(input, serpApiKey) {
  const { name, city, state, country } = input;

  // Location-neutral query: explicitly includes city/state/country (when provided)
  const parts = [name, city, state, country].filter(Boolean);
  const q = `${parts.join(" ")} official website`;

  const res = await axios.get("https://serpapi.com/search.json", {
    params: {
      engine: "google",
      q,
      api_key: serpApiKey,
      num: 10,
    },
    timeout: 20000,
  });

  return res.data;
}

module.exports = { findOfficialWebsiteSerpApi };
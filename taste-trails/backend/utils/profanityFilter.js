const PROFANITY_WORDS = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "crap",
  "damn",
  "dick",
  "fuck",
  "fucking",
  "motherfucker",
  "piss",
  "shit",
  "slut",
  "whore"
];

const PROFANITY_RE = new RegExp(`\\b(${PROFANITY_WORDS.join("|")})\\b`, "i");
const PROFANITY_RE_GLOBAL = new RegExp(`\\b(${PROFANITY_WORDS.join("|")})\\b`, "gi");

export function hasProfanity(text = "") {
  if (!text) return false;
  return PROFANITY_RE.test(String(text));
}

export function filterProfanity(text = "") {
  if (!text) return "";
  return String(text).replace(PROFANITY_RE_GLOBAL, (match) => "*".repeat(match.length));
}

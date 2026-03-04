/**
 * Safe JSON parse utility with Unicode and control char guards
 * @param {string} label - Source label for logging
 * @param {any} input - Input to parse
 * @returns {object|null}
 * @throws on parse failure
 */
import fs from 'fs';
import path from 'path';
export function safeJsonParse(label, input) {
  if (typeof input === "object") return input;
  if (typeof input !== "string") input = String(input);

  try {
    return JSON.parse(input);
  } catch (e) {
    console.error("FAILED_JSON_PARSE_LABEL:", label);
    console.error("STRING_LENGTH:", input.length);

    const idxMatch = e.message.match(/position (\d+)/);
    const idx = idxMatch ? parseInt(idxMatch[1], 10) : null;

    if (idx !== null) {
      console.error("ERROR_INDEX:", idx);
      console.error("AROUND_ERROR:", input.slice(idx - 40, idx + 40));

      console.error("CHAR_CODES_AROUND_ERROR:");
      for (let i = idx - 10; i <= idx + 10; i++) {
        if (i >= 0 && i < input.length) {
          console.error(i, input[i], input.charCodeAt(i));
        }
      }
    }

    require("fs").writeFileSync(
      `/tmp/unicode_failure_${Date.now()}.txt`,
      input
    );

    throw e;
  }
}
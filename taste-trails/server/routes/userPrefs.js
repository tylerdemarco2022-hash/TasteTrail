/**
 * User Preferences Routes
 * Handles per-user settings that aren't core auth data:
 *   - Notification preferences
 */
import express from "express";
import { readJSON, writeJSON } from "../../backend/utils/localDB.js";
import { resolveAuth } from "./auth.js";

const router = express.Router();

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function getAllPrefs() {
  const data = readJSON("notification_preferences.json");
  // readJSON returns [] when file is missing; normalise to object
  return Array.isArray(data) ? {} : (data && typeof data === "object" ? data : {});
}

function saveAllPrefs(data) {
  writeJSON("notification_preferences.json", data);
}

const DEFAULT_PREFS = {
  pushEnabled: true,
  emailEnabled: true,
  soundEnabled: true,
  alerts: {
    newRatings: true,
    followRequests: true,
    trendingRestaurants: true,
    dishMilestones: true,
    adminBroadcasts: true,
  },
  frequency: "instant",
};

// GET /api/notification-preferences
router.get("/notification-preferences", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) return sendError(res, auth.status, auth.message);

    const userId = String(auth.user?.id || auth.localUser?.id || "");
    if (!userId) return sendError(res, 400, "Could not determine user id");

    const all = getAllPrefs();
    const prefs = all[userId] || DEFAULT_PREFS;

    return res.json({ success: true, ...prefs });
  } catch (err) {
    console.error("GET /notification-preferences error:", err);
    return sendError(res, 500, "Failed to load notification preferences");
  }
});

// PUT /api/notification-preferences
router.put("/notification-preferences", async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth.ok) return sendError(res, auth.status, auth.message);

    const userId = String(auth.user?.id || auth.localUser?.id || "");
    if (!userId) return sendError(res, 400, "Could not determine user id");

    const { pushEnabled, emailEnabled, soundEnabled, alerts, frequency } = req.body || {};

    const all = getAllPrefs();
    const existing = all[userId] || { ...DEFAULT_PREFS };

    const updated = {
      pushEnabled:  typeof pushEnabled  === "boolean" ? pushEnabled  : existing.pushEnabled,
      emailEnabled: typeof emailEnabled === "boolean" ? emailEnabled : existing.emailEnabled,
      soundEnabled: typeof soundEnabled === "boolean" ? soundEnabled : existing.soundEnabled,
      alerts:       alerts && typeof alerts === "object" ? { ...existing.alerts, ...alerts } : existing.alerts,
      frequency:    ["instant", "daily", "weekly"].includes(frequency) ? frequency : existing.frequency,
    };

    all[userId] = updated;
    saveAllPrefs(all);

    return res.json({ success: true, ...updated });
  } catch (err) {
    console.error("PUT /notification-preferences error:", err);
    return sendError(res, 500, "Failed to save notification preferences");
  }
});

export default router;

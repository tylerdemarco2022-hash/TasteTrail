import express from "express";
import crypto from "crypto";
import { supabase } from "../../backend/supabase.js";
import { readJSON, writeJSON } from "../../backend/utils/localDB.js";
import { resolveAuth } from "./auth.js";

const router = express.Router();
const MENU_FLAG_FILE = "menu_item_flags.json";
const REVIEW_REPORT_FILE = "review_reports.json";

function nowIso() {
  return new Date().toISOString();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function tableMissing(error) {
  const message = String(error?.message || error || "");
  return /does not exist|relation .* does not exist/i.test(message);
}

async function requireAuth(req, res) {
  const auth = await resolveAuth(req);
  if (!auth.ok) {
    res.status(auth.status || 401).json({ error: auth.message || "Unauthorized" });
    return null;
  }
  return auth;
}

async function requireAdmin(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  if (auth.profile?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return auth;
}

function readLocalFlags() {
  return normalizeArray(readJSON(MENU_FLAG_FILE));
}

function writeLocalFlags(flags) {
  writeJSON(MENU_FLAG_FILE, flags);
}

function readLocalReports() {
  return normalizeArray(readJSON(REVIEW_REPORT_FILE));
}

function writeLocalReports(reports) {
  writeJSON(REVIEW_REPORT_FILE, reports);
}

router.post("/menu-item-flags", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const {
    menu_item_id,
    restaurant_id,
    restaurant_name,
    item_name,
    reason,
    details
  } = req.body || {};

  if (!item_name) {
    return res.status(400).json({ error: "Item name is required" });
  }

  const payload = {
    menu_item_id: menu_item_id || null,
    restaurant_id: restaurant_id || null,
    restaurant_name: restaurant_name || null,
    item_name: String(item_name).trim(),
    reason: reason ? String(reason).trim() : "unspecified",
    details: details ? String(details).trim() : null,
    status: "open",
    reported_by: auth.user?.id || auth.profile?.id || null,
    reporter_email: auth.profile?.email || null,
    created_at: nowIso()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("menu_item_flags")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to flag menu item" });
      }
    } else {
      return res.json(data);
    }
  }

  const localFlags = readLocalFlags();
  const localFlag = {
    id: crypto.randomUUID(),
    ...payload
  };
  localFlags.unshift(localFlag);
  writeLocalFlags(localFlags);
  return res.json(localFlag);
});

router.get("/admin/menu-item-flags", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (supabase) {
    const { data, error } = await supabase
      .from("menu_item_flags")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to load flags" });
      }
    } else {
      return res.json({ flags: data || [] });
    }
  }

  return res.json({ flags: readLocalFlags() });
});

router.patch("/admin/menu-item-flags/:flagId", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { flagId } = req.params;
  const { status, resolution_note } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const updates = {
    status,
    resolution_note: resolution_note ? String(resolution_note).trim() : null,
    resolved_at: status === "resolved" || status === "dismissed" ? nowIso() : null
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("menu_item_flags")
      .update(updates)
      .eq("id", flagId)
      .select()
      .single();

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to update flag" });
      }
    } else {
      return res.json(data);
    }
  }

  const localFlags = readLocalFlags();
  const idx = localFlags.findIndex((flag) => String(flag.id) === String(flagId));
  if (idx === -1) return res.status(404).json({ error: "Flag not found" });
  localFlags[idx] = { ...localFlags[idx], ...updates };
  writeLocalFlags(localFlags);
  return res.json(localFlags[idx]);
});

router.post("/review-reports", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const {
    dish_rating_id,
    menu_item_id,
    restaurant_id,
    restaurant_name,
    dish_name,
    rating_value,
    comment,
    reason,
    details
  } = req.body || {};

  const payload = {
    dish_rating_id: dish_rating_id || null,
    menu_item_id: menu_item_id || null,
    restaurant_id: restaurant_id || null,
    restaurant_name: restaurant_name || null,
    dish_name: dish_name ? String(dish_name).trim() : null,
    rating_value: Number.isFinite(Number(rating_value)) ? Number(rating_value) : null,
    comment_snapshot: comment ? String(comment).trim() : null,
    reason: reason ? String(reason).trim() : "unspecified",
    details: details ? String(details).trim() : null,
    status: "open",
    reported_by: auth.user?.id || auth.profile?.id || null,
    reporter_email: auth.profile?.email || null,
    created_at: nowIso()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("review_reports")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to report review" });
      }
    } else {
      return res.json(data);
    }
  }

  const localReports = readLocalReports();
  const localReport = {
    id: crypto.randomUUID(),
    ...payload
  };
  localReports.unshift(localReport);
  writeLocalReports(localReports);
  return res.json(localReport);
});

router.get("/admin/review-reports", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (supabase) {
    const { data, error } = await supabase
      .from("review_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to load reports" });
      }
    } else {
      return res.json({ reports: data || [] });
    }
  }

  return res.json({ reports: readLocalReports() });
});

router.patch("/admin/review-reports/:reportId", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { reportId } = req.params;
  const { status, resolution_note } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const updates = {
    status,
    resolution_note: resolution_note ? String(resolution_note).trim() : null,
    resolved_at: status === "resolved" || status === "dismissed" ? nowIso() : null
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("review_reports")
      .update(updates)
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      if (!tableMissing(error)) {
        return res.status(400).json({ error: error.message || "Failed to update report" });
      }
    } else {
      return res.json(data);
    }
  }

  const localReports = readLocalReports();
  const idx = localReports.findIndex((report) => String(report.id) === String(reportId));
  if (idx === -1) return res.status(404).json({ error: "Report not found" });
  localReports[idx] = { ...localReports[idx], ...updates };
  writeLocalReports(localReports);
  return res.json(localReports[idx]);
});

export default router;

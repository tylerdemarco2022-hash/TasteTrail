import { useState, useEffect, memo } from "react";
import { Star, Flag } from "lucide-react";

// ── Dietary tag inference ─────────────────────────────────────────────────────
function inferDietaryTags(name = "", description = "") {
  const text = `${name} ${description}`.toLowerCase();
  const tags = [];
  if (/(vegetarian|veggie|\bveg\b|meatless|plant.based)/.test(text))
    tags.push({ label: "Veggie", cls: "bg-green-100 text-green-700" });
  if (/(vegan|plant.based|dairy.free|no dairy)/.test(text))
    tags.push({ label: "Vegan", cls: "bg-emerald-100 text-emerald-700" });
  if (/(gluten.free|\bgf\b|no gluten)/.test(text))
    tags.push({ label: "GF", cls: "bg-yellow-100 text-yellow-700" });
  if (/(spicy|jalapeño|sriracha|habanero|hot sauce|\bchili\b)/.test(text))
    tags.push({ label: "Spicy", cls: "bg-red-100 text-red-700" });
  return tags;
}

// ── Best-guess food emoji for thumbnail placeholder ───────────────────────────
const FOOD_EMOJIS = ["🍕", "🍔", "🥗", "🍜", "🍣", "🌮", "🥩", "🍰", "🥘", "🍤"];
function itemEmoji(name = "") {
  const n = name.toLowerCase();
  if (/(pizza|margherita|pepperoni)/.test(n)) return "🍕";
  if (/(burger|cheeseburger)/.test(n)) return "🍔";
  if (/(salad|caesar|greens)/.test(n)) return "🥗";
  if (/(pasta|spaghetti|fettuccine|penne|linguine|ravioli|carbonara)/.test(n)) return "🍝";
  if (/(noodle|ramen|pho|pad thai|udon)/.test(n)) return "🍜";
  if (/(sushi|roll|maki|nigiri)/.test(n)) return "🍣";
  if (/(taco|burrito|quesadilla|fajita)/.test(n)) return "🌮";
  if (/(steak|ribs|beef|lamb|pork|chicken|salmon|fish|shrimp|seafood)/.test(n)) return "🥩";
  if (/(cake|brownie|dessert|ice cream|gelato|tiramisu|cheesecake)/.test(n)) return "🍰";
  if (/(soup|chowder|bisque|stew)/.test(n)) return "🍲";
  if (/(cocktail|wine|beer|mojito|margarita|drink|lemonade|tea|coffee)/.test(n)) return "🍹";
  if (/(sandwich|panini|wrap|sub|hoagie)/.test(n)) return "🥪";
  if (/(wings|nugget|tender)/.test(n)) return "🍗";
  const seed = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return FOOD_EMOJIS[seed % FOOD_EMOJIS.length];
}

// ── Compact star row ──────────────────────────────────────────────────────────
function StarRow({ rating }) {
  const full = Math.round((Number(rating) / 10) * 5);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= full ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
// Memoize to prevent unnecessary re-renders when parent updates
export default memo(function MenuCard({
  item,
  isSaved = false,
  onSave,
  onRate,
  onFlag,
  isFlagged = false,
  onShowSummary,
  ratingDisplay,
  // Legacy restaurant-card props (Home.jsx)
  restaurantName,
  restaurantId,
  onMenuClick,
}) {
  // ── Legacy restaurant card ──
  if (!item && restaurantName) {
    return (
      <div
        style={{
          borderRadius: 14,
          padding: "14px 18px",
          margin: "6px 0",
          background: "#fff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.09)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#111827" }}>
          {restaurantName}
        </h3>
        <button
          onClick={() => onMenuClick && onMenuClick(restaurantId)}
          style={{
            padding: "7px 14px",
            borderRadius: 9,
            background: "#f59e0b",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            cursor: "pointer",
          }}
        >
          View Menu
        </button>
      </div>
    );
  }

  // ── Menu item card ──
  const [liked, setLiked] = useState(isSaved);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { setLiked(isSaved); }, [isSaved]);

  if (!item) return null;

  const name        = item.name || item.dish_name || item.dish || item.title || "";
  const description = item.description || item.desc || "";
  const price       = item.price;
  const image       = item.image || item.photo || item.image_url || null;
  const tags        = inferDietaryTags(name, description);
  const emoji       = itemEmoji(name);
  const rating      = ratingDisplay?.rating ? Number(ratingDisplay.rating) : null;
  const ratingCount = ratingDisplay?.count || 0;
  const flagged = Boolean(isFlagged);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        console.log('MenuCard clicked:', item.name, 'onShowSummary:', typeof onShowSummary);
        setPressed(true);
        setTimeout(() => setPressed(false), 150);
        if (onShowSummary) {
          onShowSummary(item);
        } else {
          console.warn('onShowSummary is not defined');
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 14px",
        background: hovered ? "#fffbeb" : "#fff",
        borderRadius: 12,
        border: "1px solid #f3f4f6",
        boxShadow: hovered
          ? "0 4px 14px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
        transform: pressed ? "scale(0.99)" : mounted ? "translateY(0)" : "translateY(4px)",
        opacity: mounted ? 1 : 0,
      }}
    >
      {/* ── Text content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + price */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              flex: 1,
            }}
          >
            {name}
          </span>
          {price && (
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", whiteSpace: "nowrap", flexShrink: 0 }}>
              {price}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 12,
              color: "#9ca3af",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </p>
        )}

        {/* Rating + tags row */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {rating !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <StarRow rating={rating} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#d97706" }}>{rating.toFixed(1)}</span>
              {ratingCount > 0 && (
                <span style={{ fontSize: 10, color: "#d1d5db" }}>({ratingCount})</span>
              )}
            </div>
          )}
          {tags.map((tag) => (
            <span
              key={tag.label}
              className={tag.cls}
              style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}
            >
              {tag.label}
            </span>
          ))}
          {onRate && (
            <button
              onClick={(e) => { e.stopPropagation(); onRate(item); }}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "#f59e0b",
                cursor: "pointer",
              }}
            >
              Rate →
            </button>
          )}
        </div>
      </div>

      {/* ── Thumbnail ── */}
      <div
        style={{
          position: "relative",
          width: 76,
          height: 76,
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
        }}
      >
        {image ? (
          <img
            src={image}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: hovered ? "scale(1.07)" : "scale(1)",
              transition: "transform 0.3s ease",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 30, userSelect: "none" }} role="img" aria-hidden="true">
              {emoji}
            </span>
          </div>
        )}

        {onFlag && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFlag(item);
            }}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: flagged ? "rgba(248,113,113,0.95)" : "rgba(255,255,255,0.9)",
              border: flagged ? "1px solid rgba(248,113,113,0.7)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            aria-label={flagged ? "Flagged" : "Flag item"}
            title={flagged ? "Flagged" : "Flag as incorrect"}
          >
            <Flag size={12} color={flagged ? "#fff" : "#ef4444"} />
          </button>
        )}

        {/* Heart button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLiked((prev) => !prev);
            onSave?.(item);
          }}
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            transition: "transform 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          aria-label={liked ? "Unsave" : "Save"}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={liked ? "#ef4444" : "none"}
            stroke={liked ? "#ef4444" : "#9ca3af"}
            strokeWidth={2.5}
            style={{ transition: "all 0.2s ease" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
})

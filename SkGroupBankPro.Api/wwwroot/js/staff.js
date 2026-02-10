// wwwroot/js/staff.js
document.addEventListener("DOMContentLoaded", async () => {
  // Require Staff/Admin
  if (typeof requireAuth === "function") {
    requireAuth(["Admin", "Staff"]);
  }

  const $ = (id) => document.getElementById(id);

  const gameSelMain = $("gameTypeSelect");
  const gameSelEdit = $("editGameTypeSelect");

  // ✅ Always available fallback games (exact names you want)
  const FALLBACK_GAMES = [
    { id: "918kaya", name: "918Kaya" },
    { id: "mega88",  name: "Mega88" },
    { id: "scr888",  name: "SCR888" },
    { id: "live22",  name: "Live22" },
    { id: "joker123", name: "Joker123" },
    { id: "megah5",  name: "MegaH5" }
  ];

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderGameOptions(selectEl, list) {
    if (!selectEl) return;

    const prev = selectEl.value || "";
    selectEl.innerHTML =
      `<option value="">Game Type (optional)</option>` +
      list.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join("");

    if (prev) selectEl.value = prev;
  }

  function normalizeApiGames(apiGames) {
    if (!Array.isArray(apiGames)) return [];
    return apiGames
      .filter(g => g && g.name && g.isEnabled !== false)
      .map(g => ({ id: String(g.id ?? ""), name: String(g.name ?? "") }));
  }

  function mergeUniqueByName(apiList, fallbackList) {
    const map = new Map();

    // API first priority
    for (const g of apiList) {
      const key = (g.name || "").trim().toLowerCase();
      if (!key) continue;
      map.set(key, g);
    }

    // Add fallback if missing
    for (const g of fallbackList) {
      const key = (g.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, g);
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadGameTypesAlways() {
    // 1) Always render fallback immediately (never empty)
    renderGameOptions(gameSelMain, FALLBACK_GAMES);
    renderGameOptions(gameSelEdit, FALLBACK_GAMES);

    // 2) Try API, then replace/merge
    try {
      if (typeof apiFetch !== "function") return;

      const apiGames = await apiFetch("/api/gametypes");
      const normalized = normalizeApiGames(apiGames);

      if (normalized.length > 0) {
        const merged = mergeUniqueByName(normalized, FALLBACK_GAMES);
        renderGameOptions(gameSelMain, merged);
        renderGameOptions(gameSelEdit, merged);
      }
    } catch (err) {
      // API failed -> keep fallback (already rendered)
      console.warn("GameTypes API failed; using fallback list.", err);
    }
  }

  await loadGameTypesAlways();
});

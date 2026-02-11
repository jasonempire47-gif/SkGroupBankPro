// wwwroot/js/staff.js
document.addEventListener("DOMContentLoaded", async () => {
  // Require Staff/Admin
  if (typeof requireAuth === "function") {
    requireAuth(["Admin", "Staff"]);
  }

  const $ = (id) => document.getElementById(id);

  // Prevent any <form> from refreshing the page
  document.querySelectorAll("form").forEach(f => {
    f.addEventListener("submit", (e) => e.preventDefault());
  });

  // ---- Elements (must exist in staff.html) ----
  const cName = $("cName");
  const cPhone = $("cPhone");
  const btnCreateCustomer = $("btnCreateCustomer");
  const createCustomerMsg = $("createCustomerMsg");

  const txKind = $("txKind");
  const customerSelect = $("customerSelect");
  const gameSelMain = $("gameTypeSelect");
  const bankType = $("bankType");
  const referenceNo = $("referenceNo");
  const amount = $("amount");
  const notes = $("notes");
  const createdAtUtc = $("createdAtUtc");
  const btnSubmitTx = $("btnSubmitTx");
  const txMsg = $("txMsg");

  const gameSelEdit = $("editGameTypeSelect"); // optional

  // ---- Helpers ----
  function setMsg(el, text, kind = "muted") {
    if (!el) return;
    el.textContent = text || "";
    el.style.color =
      kind === "ok" ? "#7CFF9B" :
      kind === "err" ? "#FF8C8C" :
      "rgba(255,255,255,0.7)";
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // PNG time (UTC+10)
  function toPngDateTimeLocalValue(now = new Date()) {
    const pngMs = now.getTime() + (10 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000);
    const d = new Date(pngMs);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function readCreatedAtUtc() {
    const v = (createdAtUtc?.value || "").trim();
    if (!v) return new Date().toISOString();

    const [datePart, timePart] = v.split("T");
    if (!datePart || !timePart) return new Date().toISOString();

    const [Y, M, D] = datePart.split("-").map(Number);
    const [h, m] = timePart.split(":").map(Number);

    // PNG local => UTC = PNG - 10 hours
    const utc = new Date(Date.UTC(Y, (M - 1), D, h - 10, m, 0));
    return utc.toISOString();
  }

  // ---- CRITICAL: safe API wrapper to show REAL backend error ----
  async function safeApi(path, options = {}) {
    // Prefer your existing apiFetch if available, but we still want real error text
    // If apiFetch is missing or opaque, we do direct fetch.
    const token = localStorage.getItem("token") || "";
    const API_BASE = (window.API_BASE || "").trim(); // from api.js, often "" for same-origin

    const url = `${API_BASE}${path}`;

    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined && options.body !== null;

    if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (e) {
      // Network/CORS/DNS/HTTPS mixed content
      throw new Error(`NETWORK ERROR calling ${path}: ${e?.message || e}`);
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text();

    if (!res.ok) {
      // Show status + response body (most important for debugging)
      throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}: ${rawText || "(empty response)"}`);
    }

    // Try parse JSON, else return text
    if (contentType.includes("application/json")) {
      try { return JSON.parse(rawText || "null"); } catch { return rawText; }
    }
    return rawText;
  }

  // ---- Quick element sanity check ----
  function mustExist(id, el) {
    if (!el) console.warn(`[staff] Missing element with id="${id}" (check staff.html IDs)`);
  }
  mustExist("cName", cName);
  mustExist("cPhone", cPhone);
  mustExist("btnCreateCustomer", btnCreateCustomer);
  mustExist("customerSelect", customerSelect);
  mustExist("btnSubmitTx", btnSubmitTx);

  // ---- Game types (fallback always) ----
  const FALLBACK_GAMES = [
    { name: "918Kaya" },
    { name: "Mega88" },
    { name: "SCR888" },
    { name: "Live22" },
    { name: "Joker123" },
    { name: "MegaH5" }
  ];

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
      .map(g => ({ name: String(g.name ?? "") }));
  }

  function mergeUniqueByName(apiList, fallbackList) {
    const map = new Map();
    for (const g of apiList) {
      const key = (g.name || "").trim().toLowerCase();
      if (key) map.set(key, g);
    }
    for (const g of fallbackList) {
      const key = (g.name || "").trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadGameTypesAlways() {
    renderGameOptions(gameSelMain, FALLBACK_GAMES);
    renderGameOptions(gameSelEdit, FALLBACK_GAMES);

    try {
      const apiGames = await safeApi("/api/gametypes");
      const normalized = normalizeApiGames(apiGames);
      if (normalized.length > 0) {
        const merged = mergeUniqueByName(normalized, FALLBACK_GAMES);
        renderGameOptions(gameSelMain, merged);
        renderGameOptions(gameSelEdit, merged);
      }
    } catch (e) {
      console.warn("[staff] /api/gametypes failed, using fallback:", e);
    }
  }

  // ---- Customers ----
  async function loadCustomers() {
    if (!customerSelect) return;

    try {
      const rows = await safeApi("/api/customers");
      const list = Array.isArray(rows) ? rows : [];

      if (!list.length) {
        customerSelect.innerHTML = `<option value="">(No customers yet)</option>`;
        return;
      }

      customerSelect.innerHTML = list
        .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "Unnamed")}</option>`)
        .join("");
    } catch (e) {
      console.error("[staff] loadCustomers failed:", e);
      customerSelect.innerHTML = `<option value="">(Failed to load customers)</option>`;
      setMsg(createCustomerMsg, e.message || String(e), "err");
    }
  }

  async function createCustomer() {
    const name = (cName?.value || "").trim();
    const phone = (cPhone?.value || "").trim();

    setMsg(createCustomerMsg, "");

    if (!name) {
      setMsg(createCustomerMsg, "Customer name is required.", "err");
      return;
    }

    btnCreateCustomer && (btnCreateCustomer.disabled = true);

    try {
      await safeApi("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name, phone: phone || null })
      });

      setMsg(createCustomerMsg, "Customer created.", "ok");
      if (cName) cName.value = "";
      if (cPhone) cPhone.value = "";

      await loadCustomers();
    } catch (e) {
      console.error("[staff] createCustomer failed:", e);
      setMsg(createCustomerMsg, e.message || String(e), "err");
    } finally {
      btnCreateCustomer && (btnCreateCustomer.disabled = false);
    }
  }

  // ---- Transactions ----
  async function submitTx() {
    setMsg(txMsg, "");

    const kind = (txKind?.value || "").trim();
    const customerId = (customerSelect?.value || "").trim();
    const gameType = (gameSelMain?.value || "").trim();
    const bank = (bankType?.value || "").trim();
    const ref = (referenceNo?.value || "").trim();
    const amt = Number(amount?.value || 0);
    const note = (notes?.value || "").trim();

    if (!kind) return setMsg(txMsg, "Transaction type is required.", "err");
    if (!customerId) return setMsg(txMsg, "Please select a customer.", "err");
    if (!bank) return setMsg(txMsg, "Bank Type is required.", "err");
    if (!isFinite(amt) || amt <= 0) return setMsg(txMsg, "Amount must be greater than 0.", "err");

    btnSubmitTx && (btnSubmitTx.disabled = true);

    try {
      await safeApi("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          kind,
          customerId: Number(customerId),
          gameType: gameType || null,
          bankType: bank,
          referenceNo: ref || null,
          amount: amt,
          notes: note || null,
          createdAtUtc: readCreatedAtUtc()
        })
      });

      setMsg(txMsg, `${kind.toUpperCase()} submitted.`, "ok");

      if (referenceNo) referenceNo.value = "";
      if (amount) amount.value = "";
      if (notes) notes.value = "";
      if (gameSelMain) gameSelMain.value = "";

      if (typeof window.refreshAllTransactions === "function") {
        await window.refreshAllTransactions();
      }
    } catch (e) {
      console.error("[staff] submitTx failed:", e);
      setMsg(txMsg, e.message || String(e), "err");
    } finally {
      btnSubmitTx && (btnSubmitTx.disabled = false);
    }
  }

  // ---- Wire up handlers ----
  btnCreateCustomer?.addEventListener("click", createCustomer);
  btnSubmitTx?.addEventListener("click", submitTx);

  // default datetime-local to PNG time
  if (createdAtUtc) createdAtUtc.value = toPngDateTimeLocalValue(new Date());

  // ---- Initial loads ----
  await loadGameTypesAlways();
  await loadCustomers();
});

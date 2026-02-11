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

  // ---- Elements ----
  const cName = $("cName");
  const cPhone = $("cPhone");
  const btnCreateCustomer = $("btnCreateCustomer");
  const createCustomerMsg = $("createCustomerMsg");

  const txKind = $("txKind");
  const customerSelect = $("customerSelect");
  const gameSelMain = $("gameTypeSelect");     // MUST hold numeric IDs as values
  const bankType = $("bankType");
  const referenceNo = $("referenceNo");
  const amount = $("amount");
  const notes = $("notes");
  const createdAtUtc = $("createdAtUtc");      // datetime-local showing PNG time
  const btnSubmitTx = $("btnSubmitTx");
  const txMsg = $("txMsg");

  const gameSelEdit = $("editGameTypeSelect"); // optional modal select

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

  // Deterministic PNG time (UTC+10):
  // take NOW -> UTC -> +10h -> format for datetime-local
  function toPngDateTimeLocalValue(date = new Date()) {
    const utcMs = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
    const png = new Date(utcMs + (10 * 60 * 60 * 1000));
    const pad = (n) => String(n).padStart(2, "0");
    return `${png.getFullYear()}-${pad(png.getMonth() + 1)}-${pad(png.getDate())}T${pad(png.getHours())}:${pad(png.getMinutes())}`;
  }

  // UI input is PNG local => API expects UTC => subtract 10 hours
  function readCreatedAtUtc() {
    const v = (createdAtUtc?.value || "").trim();
    if (!v) return new Date().toISOString();

    const [datePart, timePart] = v.split("T");
    if (!datePart || !timePart) return new Date().toISOString();

    const [Y, M, D] = datePart.split("-").map(Number);
    const [h, m] = timePart.split(":").map(Number);

    const utc = new Date(Date.UTC(Y, (M - 1), D, h - 10, m, 0, 0));
    return utc.toISOString();
  }

  // ---- safe API wrapper (shows real status + body) ----
  async function safeApi(path, options = {}) {
    const token = localStorage.getItem("token") || "";
    const API_BASE = (window.API_BASE || "").trim(); // from api.js

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
      throw new Error(`NETWORK ERROR calling ${path}: ${e?.message || e}`);
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}: ${rawText || "(empty response)"}`);
    }

    if (contentType.includes("application/json")) {
      try { return JSON.parse(rawText || "null"); } catch { return rawText; }
    }
    return rawText;
  }

  // ---- Game types ----
  function renderGameOptions(selectEl, list, includeBlank = true) {
    if (!selectEl) return;

    const prev = selectEl.value || "";
    const blank = includeBlank ? `<option value="">Game Type (optional)</option>` : "";
    selectEl.innerHTML =
      blank +
      list.map(g => `<option value="${escapeHtml(String(g.id))}">${escapeHtml(g.name)}</option>`).join("");

    if (prev) selectEl.value = prev;
  }

  async function loadGameTypes() {
    // No fake fallback IDs here — GameTypeId must exist in DB.
    // If API fails, we keep select with only the placeholder.
    if (gameSelMain) gameSelMain.innerHTML = `<option value="">Game Type (optional)</option>`;
    if (gameSelEdit) gameSelEdit.innerHTML = `<option value="">Game Type (optional)</option>`;

    try {
      const rows = await safeApi("/api/gametypes");
      const list = Array.isArray(rows)
        ? rows
            .filter(x => x && x.id && x.name && x.isEnabled !== false)
            .map(x => ({ id: x.id, name: x.name }))
        : [];

      renderGameOptions(gameSelMain, list, true);
      renderGameOptions(gameSelEdit, list, true);
    } catch (e) {
      console.warn("[staff] /api/gametypes failed:", e);
      // keep placeholder only
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
    const phone = (cPhone?.value || "").trim(); // send "" if empty (DTO expects string)

    setMsg(createCustomerMsg, "");

    if (!name) {
      setMsg(createCustomerMsg, "Customer name is required.", "err");
      return;
    }

    btnCreateCustomer && (btnCreateCustomer.disabled = true);

    try {
      await safeApi("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name, phone: phone || "" })
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
  function getTxEndpoint(kind) {
    switch ((kind || "").toLowerCase()) {
      case "deposit": return "/api/transactions/deposit";
      case "withdrawal": return "/api/transactions/withdrawal";
      case "bonus": return "/api/transactions/bonus";
      default: return null;
    }
  }

  async function submitTx() {
    setMsg(txMsg, "");

    const kind = (txKind?.value || "").trim();
    const endpoint = getTxEndpoint(kind);

    const customerId = Number((customerSelect?.value || "").trim());
    const bank = (bankType?.value || "").trim();
    const ref = (referenceNo?.value || "").trim();
    const amt = Number(amount?.value || 0);
    const note = (notes?.value || "").trim();

    const gtRaw = (gameSelMain?.value || "").trim();
    const gameTypeId = gtRaw ? Number(gtRaw) : null;

    if (!endpoint) return setMsg(txMsg, "Invalid transaction type.", "err");
    if (!Number.isFinite(customerId) || customerId <= 0) return setMsg(txMsg, "Please select a customer.", "err");
    if (!bank) return setMsg(txMsg, "Bank Type is required.", "err");
    if (!isFinite(amt) || amt <= 0) return setMsg(txMsg, "Amount must be greater than 0.", "err");
    if (gtRaw && (!Number.isFinite(gameTypeId) || gameTypeId <= 0)) return setMsg(txMsg, "Invalid game type selected.", "err");

    btnSubmitTx && (btnSubmitTx.disabled = true);

    try {
      // Matches TransactionsController.CreateTxRequest:
      // (CustomerId, Amount, Notes, CreatedAtUtc?, BankType, ReferenceNo, GameTypeId?)
      await safeApi(endpoint, {
        method: "POST",
        body: JSON.stringify({
          customerId,
          amount: amt,
          notes: note || null,
          createdAtUtc: readCreatedAtUtc(),
          bankType: bank,
          referenceNo: ref || null,
          gameTypeId: gameTypeId
        })
      });

      setMsg(txMsg, `${kind.toUpperCase()} submitted.`, "ok");

      if (referenceNo) referenceNo.value = "";
      if (amount) amount.value = "";
      if (notes) notes.value = "";
      if (gameSelMain) gameSelMain.value = "";

      // Refresh table if available
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
  await loadGameTypes();
  await loadCustomers();
});

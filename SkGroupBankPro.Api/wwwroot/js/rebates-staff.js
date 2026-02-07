// js/rebates-staff.js  (FULL REPLACEMENT)
(function () {
  const el = (id) => document.getElementById(id);

  const cName = el("cName");
  const cPhone = el("cPhone");
  const btnCreateCustomer = el("btnCreateCustomer");
  const createCustomerMsg = el("createCustomerMsg");

  const customerSelect = el("customerSelect");
  const txKind = el("txKind");
  const gameTypeSelect = el("gameTypeSelect");
  const bankType = el("bankType");
  const referenceNo = el("referenceNo");
  const amount = el("amount");
  const notes = el("notes");
  const createdAtUtc = el("createdAtUtc");
  const btnSubmitTx = el("btnSubmitTx");
  const txMsg = el("txMsg");

  const btnRefreshTx = el("btnRefreshTx");
  const txTbody = el("txTbody");
  const todayMsg = el("todayMsg");

  // -----------------------------
  // AUTH + API HELPERS
  // -----------------------------
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function goLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "index.html";
  }

  // Uses window.API_BASE if present, else defaults to your API host
  function getApiBase() {
    const base = (window.API_BASE || "").trim();
    if (base) return base.replace(/\/+$/, "");
    return "http://localhost:5000";
  }

  const API_BASE = getApiBase();
  window.API_BASE = API_BASE;

  async function apiFetch(path, options) {
    const token = getToken();
    if (!token) {
      goLogin();
      throw new Error("No token. Please login.");
    }

    const method = options?.method || "GET";
    const body = options?.body;

    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401) {
      goLogin();
      return null;
    }

    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const msg = (data && (data.message || data.error || data.title)) || `Request failed (HTTP ${res.status})`;
      throw new Error(msg);
    }

    return data;
  }

  // -----------------------------
  // UI HELPERS
  // -----------------------------
  function setMsg(target, text, ok = true) {
    if (!target) return;
    target.innerHTML = ok
      ? `<span style="color:#7CFC9A;">${text}</span>`
      : `<span style="color:#ff6b6b;">${text}</span>`;
  }

  function fmtDateTime(d) {
    try { return new Date(d).toLocaleString(); } catch { return d; }
  }

  function todayUtcKey() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  function getTxDateValue(r) {
    // backend might return CreatedAt or CreatedAtUtc
    return r.createdAt || r.createdAtUtc || r.CreatedAt || r.CreatedAtUtc || null;
  }

  // -----------------------------
  // LOADERS
  // -----------------------------
  async function loadCustomers() {
    const data = await apiFetch("/api/customers");
    if (!customerSelect) return;

    customerSelect.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No customers";
      customerSelect.appendChild(opt);
      return;
    }

    for (const c of data) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (ID ${c.id})`;
      customerSelect.appendChild(opt);
    }
  }

  async function loadGames() {
    if (!gameTypeSelect) return;

    gameTypeSelect.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Game Type (optional)";
    gameTypeSelect.appendChild(opt0);

    try {
      const data = await apiFetch("/api/game-types");

      // If your API doesn't have isEnabled, we just show all.
      const list = Array.isArray(data) ? data : [];
      const enabledOnly = list.filter(g => g.isEnabled === true);
      const finalList = enabledOnly.length ? enabledOnly : list;

      for (const g of finalList) {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name;
        gameTypeSelect.appendChild(opt);
      }
    } catch (e) {
      console.warn("Game types load failed:", e.message);
    }
  }

  // -----------------------------
  // ACTIONS
  // -----------------------------
  async function createCustomer() {
    const name = (cName?.value || "").trim();
    const phone = (cPhone?.value || "").trim();

    if (!name) return setMsg(createCustomerMsg, "Customer name is required.", false);

    if (btnCreateCustomer) btnCreateCustomer.disabled = true;
    setMsg(createCustomerMsg, "Creating...", true);

    try {
      // If backend ignores phone, that's fine.
      await apiFetch("/api/customers", {
        method: "POST",
        body: { name, phone }
      });

      setMsg(createCustomerMsg, "Customer created!", true);
      if (cName) cName.value = "";
      if (cPhone) cPhone.value = "";
      await loadCustomers();
    } catch (e) {
      setMsg(createCustomerMsg, e.message, false);
    } finally {
      if (btnCreateCustomer) btnCreateCustomer.disabled = false;
    }
  }

  async function submitTransaction() {
    const customerId = parseInt(customerSelect?.value || "0", 10);
    const kind = txKind?.value || "deposit";
    const amt = parseFloat(amount?.value || "0");

    if (!customerId) return setMsg(txMsg, "Select a customer.", false);
    if (!amt || amt <= 0) return setMsg(txMsg, "Amount must be > 0.", false);

    const gameTypeIdRaw = (gameTypeSelect?.value || "").trim();
    const gameTypeId = gameTypeIdRaw ? parseInt(gameTypeIdRaw, 10) : null;

    const created = (createdAtUtc?.value || "").trim();
    const createdIso = created ? new Date(created).toISOString() : null;

    const payload = {
      customerId,
      amount: amt,
      notes: (notes?.value || "").trim() || null,
      createdAtUtc: createdIso,
      bankType: (bankType?.value || "").trim() || null,
      referenceNo: (referenceNo?.value || "").trim() || null,
      gameTypeId
    };

    if (btnSubmitTx) btnSubmitTx.disabled = true;
    setMsg(txMsg, "Submitting...", true);

    try {
      // ✅ Swagger shows /api/Transactions (capital T)
      await apiFetch(`/api/Transactions/${kind}`, {
        method: "POST",
        body: payload
      });

      setMsg(txMsg, "Transaction submitted!", true);
      if (amount) amount.value = "";
      if (notes) notes.value = "";
      if (referenceNo) referenceNo.value = "";
      if (createdAtUtc) createdAtUtc.value = "";

      await loadTodayTransactions();
    } catch (e) {
      setMsg(txMsg, e.message, false);
    } finally {
      if (btnSubmitTx) btnSubmitTx.disabled = false;
    }
  }

  // -----------------------------
  // TABLE
  // -----------------------------
  function renderTransactions(rows) {
    if (!txTbody) return;
    txTbody.innerHTML = "";

    for (const r of rows) {
      const dtVal = getTxDateValue(r);
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.customerName || ""}</td>
        <td>${r.type}</td>
        <td>${r.gameTypeName || "-"}</td>
        <td class="right">${Number(r.amount).toFixed(2)}</td>
        <td>${r.status}</td>
        <td>${r.bankType || "-"}</td>
        <td>${dtVal ? fmtDateTime(dtVal) : "-"}</td>
      `;

      txTbody.appendChild(tr);
    }
  }

  async function loadTodayTransactions() {
    setMsg(todayMsg, "Loading today’s transactions...", true);

    // ✅ Swagger shows /api/Transactions (capital T)
    const rows = await apiFetch("/api/Transactions?take=200");

    const today = todayUtcKey();
    const todayRows = (Array.isArray(rows) ? rows : []).filter(r => {
      const dt = getTxDateValue(r);
      if (!dt) return false;
      try {
        const k = new Date(dt).toISOString().slice(0, 10);
        return k === today;
      } catch {
        return false;
      }
    });

    renderTransactions(todayRows);

    if (todayRows.length === 0) {
      setMsg(todayMsg, `No transactions recorded today (UTC date: ${today}).`, false);
    } else {
      setMsg(todayMsg, `Showing ${todayRows.length} transaction(s) for today (UTC date: ${today}).`, true);
    }
  }

  // -----------------------------
  // WIRE EVENTS
  // -----------------------------
  if (btnCreateCustomer) btnCreateCustomer.addEventListener("click", createCustomer);
  if (btnSubmitTx) btnSubmitTx.addEventListener("click", submitTransaction);
  if (btnRefreshTx) btnRefreshTx.addEventListener("click", loadTodayTransactions);

  // Init
  (async function init() {
    try {
      // If not logged in, bounce immediately
      if (!getToken()) return goLogin();

      await loadCustomers();
      await loadGames();
      await loadTodayTransactions();
    } catch (e) {
      console.error(e);
      setMsg(todayMsg, e?.message || "Init failed.", false);
    }
  })();
})();

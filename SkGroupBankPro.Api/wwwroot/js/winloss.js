// frontend/js/winloss.js  (FULL REPLACEMENT)
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const wlCustomerSelect = document.getElementById("wlCustomerSelect");
  const wlGameTypeSelect = document.getElementById("wlGameTypeSelect");
  const wlMsg = document.getElementById("wlMsg");

  function setMsg(text, ok = true) {
    if (!wlMsg) return;
    wlMsg.style.color = ok ? "#7CFC9A" : "#ff6b6b";
    wlMsg.textContent = text || "";
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  function toIsoDateOnly(v) {
    if (!v) return "-";
    try { return new Date(v).toISOString().slice(0, 10); } catch { return String(v).slice(0, 10); }
  }

  async function loadCustomers() {
    const customers = await apiFetch("/api/customers");
    if (!wlCustomerSelect) return;

    wlCustomerSelect.innerHTML = (Array.isArray(customers) ? customers : [])
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
  }

  async function loadGameTypes() {
    // ✅ Swagger route is /api/game-types
    const games = await apiFetch("/api/game-types");
    if (!wlGameTypeSelect) return;

    wlGameTypeSelect.innerHTML = (Array.isArray(games) ? games : [])
      .map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join("");
  }

  async function fetchWinLossRows(limit = 30) {
    // Try a "recent" endpoint if you have it; otherwise fallback to /api/winloss
    try {
      const rows = await apiFetch(`/api/winloss/recent?limit=${limit}`);
      if (Array.isArray(rows)) return rows;
    } catch (e) {
      // if backend doesn't implement /recent, we fallback below
      console.warn("winloss recent endpoint not available, fallback to /api/winloss:", e?.message || e);
    }

    const rows = await apiFetch("/api/winloss");
    if (!Array.isArray(rows)) return [];
    return rows.slice(-limit).reverse(); // show newest first (best effort)
  }

  async function loadRecentWinLoss() {
    const tbody = document.getElementById("wlTbody");
    if (!tbody) return;

    const rows = await fetchWinLossRows(30);

    tbody.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");

      // handle multiple field names safely
      const customerName = r.customerName ?? r.CustomerName ?? "-";
      const gameTypeName = r.gameTypeName ?? r.GameTypeName ?? "-";
      const winAmount = r.winAmount ?? r.WinAmount ?? 0;
      const lossAmount = r.lossAmount ?? r.LossAmount ?? 0;
      const dateUtc = r.dateUtc ?? r.DateUtc ?? r.date ?? r.Date ?? null;

      tr.innerHTML = `
        <td>${escapeHtml(r.id ?? r.Id ?? "")}</td>
        <td>${escapeHtml(customerName)}</td>
        <td>${escapeHtml(gameTypeName)}</td>
        <td class="right">${Number(winAmount || 0).toFixed(2)}</td>
        <td class="right">${Number(lossAmount || 0).toFixed(2)}</td>
        <td>${escapeHtml(toIsoDateOnly(dateUtc))}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  document.getElementById("btnSubmitWinLoss")?.addEventListener("click", async () => {
    setMsg("");

    const customerId = Number(wlCustomerSelect?.value || 0);
    const gameTypeId = Number(wlGameTypeSelect?.value || 0);

    const winAmount = Number(document.getElementById("winAmount")?.value || 0);
    const lossAmount = Number(document.getElementById("lossAmount")?.value || 0);

    const dateRaw = document.getElementById("wlDateUtc")?.value || "";
    const dateUtc = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();

    if (!customerId || !gameTypeId) {
      setMsg("Customer and Game Type are required.", false);
      return;
    }

    try {
      // Swagger shows POST /api/winloss
      await apiFetch("/api/winloss", {
        method: "POST",
        body: { customerId, gameTypeId, winAmount, lossAmount, dateUtc }
      });

      setMsg("Win/Loss saved.", true);
      await loadRecentWinLoss();
    } catch (e) {
      setMsg(`Error: ${e.message || e}`, false);
    }
  });

  document.getElementById("btnRefreshWinLoss")?.addEventListener("click", () => {
    loadRecentWinLoss().catch(e => setMsg(`Error: ${e.message || e}`, false));
  });

  // Init
  try {
    await loadCustomers();
    await loadGameTypes();
    await loadRecentWinLoss();
  } catch (e) {
    setMsg(`Init error: ${e.message || e}`, false);
  }
});

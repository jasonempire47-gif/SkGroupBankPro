// wwwroot/js/rebates.js
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const role = (localStorage.getItem("role") || "").trim();
  const canApproveReject = role === "Admin" || role === "Finance" || role === "Staff";

  const rebateDate = document.getElementById("rebateDate");
  const btnRunRebates = document.getElementById("btnRunRebates");
  const rebateRunResult = document.getElementById("rebateRunResult");

  const rebateListDate = document.getElementById("rebateListDate");
  const btnRebateToday = document.getElementById("btnRebateToday");
  const btnRebateAllDates = document.getElementById("btnRebateAllDates");

  const rebateHistFilter = document.getElementById("rebateHistFilter");
  const btnHistRefresh = document.getElementById("btnHistRefresh");
  const rebateHistTbody = document.getElementById("rebateHistTbody");
  const rebateListMsg = document.getElementById("rebateListMsg");

  const liveRebateDate = document.getElementById("liveRebateDate");
  const btnLiveRefresh = document.getElementById("btnLiveRefresh");
  const liveRebateMsg = document.getElementById("liveRebateMsg");
  const liveRebateTbody = document.getElementById("liveRebateTbody");

  const PNG_TZ = "Pacific/Port_Moresby";

  function setMsg(el, text, ok = true) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "#8ef0b7" : "#ff8b8b";
  }

  function todayPngDateString() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: PNG_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const map = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  }

  function yyyymmdd(dateStr /* YYYY-MM-DD */) {
    return (dateStr || "").replaceAll("-", "");
  }

  function fmt2(n) { return Number(n || 0).toFixed(2); }

  function fmtDate(val) {
    if (!val) return "";
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  }

  // ✅ Load rebate transactions from WalletTransactions list
  // Filters:
  // - Type=Rebate
  // - Status filter (approved/pending/rejected/all)
  // - PNG Date filter using ReferenceNo prefix: REB-YYYYMMDD-
  async function loadRebateTransactions() {
    rebateHistTbody.innerHTML = "";
    setMsg(rebateListMsg, "", true);

    const statusFilter = (rebateHistFilter?.value || "approved").toLowerCase();
    const pngDate = (rebateListDate?.value || "").trim(); // YYYY-MM-DD or empty
    const prefix = pngDate ? `REB-${yyyymmdd(pngDate)}-` : null;

    // load more transactions so rebates show up
    const rows = await apiFetch("/api/transactions?take=200");
    const list = Array.isArray(rows) ? rows : [];

    let rebates = list.filter(x => String(x.typeName || "").toLowerCase() === "rebate");

    if (prefix) {
      rebates = rebates.filter(x => String(x.referenceNo || "").startsWith(prefix));
    }

    const filtered =
      statusFilter === "all"
        ? rebates
        : rebates.filter(x => String(x.statusName || "").toLowerCase() === statusFilter);

    const labelDate = pngDate ? `PNG ${pngDate}` : "All PNG dates";
    setMsg(rebateListMsg, `Showing ${filtered.length} rebate(s) • ${labelDate} • Status: ${statusFilter.toUpperCase()}`, true);

    if (filtered.length === 0) {
      rebateHistTbody.innerHTML = `<tr><td colspan="8" class="mutedSmall">No rebate transactions found.</td></tr>`;
      return;
    }

    rebateHistTbody.innerHTML = filtered.map(r => {
      const id = r.id;
      const status = String(r.statusName || "");
      const isPending = status.toLowerCase() === "pending";

      const actions = (isPending && canApproveReject)
        ? `
          <button class="btn" data-act="approve" data-id="${id}" type="button">Approve</button>
          <button class="btn ghost" data-act="reject" data-id="${id}" type="button">Reject</button>
        `
        : `<span class="mutedSmall">-</span>`;

      return `
        <tr>
          <td>${escapeHtml(String(r.id ?? ""))}</td>
          <td>${escapeHtml(r.customerName || "")}</td>
          <td>${escapeHtml(r.gameTypeName || "-")}</td>
          <td class="right">${escapeHtml(fmt2(r.amount))}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(r.referenceNo || "")}</td>
          <td>${escapeHtml(fmtDate(r.createdAt))}</td>
          <td style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
            ${actions}
          </td>
        </tr>
      `;
    }).join("");
  }

  async function approveTx(id) {
    await apiFetch(`/api/transactions/${id}/approve`, { method: "PATCH" });
  }

  async function rejectTx(id) {
    const reason = prompt("Reject reason (optional):") || "";
    await apiFetch(`/api/transactions/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason })
    });
  }

  rebateHistTbody?.addEventListener("click", async (e) => {
    const btn = e.target?.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = Number(btn.getAttribute("data-id") || 0);
    if (!id) return;

    try {
      btn.disabled = true;

      if (act === "approve") await approveTx(id);
      if (act === "reject") await rejectTx(id);

      await loadRebateTransactions();
    } catch (err) {
      alert(String(err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  // Manual run (kept for compatibility)
  async function runDailyRebates() {
    const d = (rebateDate?.value || "").trim();
    if (!d) return setMsg(rebateRunResult, "Please select a PNG business date.", false);

    try {
      const res = await apiFetch(`/api/rebates/run?businessDate=${encodeURIComponent(d)}`, { method: "POST" });
      rebateRunResult.textContent = JSON.stringify(res, null, 2);

      // refresh with current filters
      await loadRebateTransactions();
    } catch (e) {
      rebateRunResult.textContent = String(e?.message || e);
    }
  }

  // Report (still from rebates controller)
  async function loadRebateReport() {
    const d = (liveRebateDate?.value || "").trim();
    if (!d) return;

    liveRebateTbody.innerHTML = "";
    setMsg(liveRebateMsg, "", true);

    const from = d;
    const to = d;

    try {
      const rows = await apiFetch(`/api/rebates/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const list = Array.isArray(rows) ? rows : [];

      if (list.length === 0) {
        setMsg(
          liveRebateMsg,
          "No rebate report rows. Usually means no Daily Win/Loss records (or NetLoss <= 0) for this PNG date.",
          false
        );
        return;
      }

      liveRebateTbody.innerHTML = list.map(r => `
        <tr>
          <td>${escapeHtml(r.customerName || "")}</td>
          <td>${escapeHtml(r.gameTypeName || "-")}</td>
          <td class="right">${escapeHtml(fmt2(r.netLoss))}</td>
          <td class="right">${escapeHtml(fmt2(r.expectedRebate))}</td>
          <td>${escapeHtml(r.businessDatePng || d)}</td>
        </tr>
      `).join("");

      setMsg(liveRebateMsg, `Loaded ${list.length} row(s).`, true);
    } catch (e) {
      setMsg(liveRebateMsg, String(e?.message || e), false);
    }
  }

  // wire events
  btnRunRebates?.addEventListener("click", runDailyRebates);

  btnHistRefresh?.addEventListener("click", loadRebateTransactions);
  rebateHistFilter?.addEventListener("change", loadRebateTransactions);
  rebateListDate?.addEventListener("change", loadRebateTransactions);

  btnRebateToday?.addEventListener("click", async () => {
    rebateListDate.value = todayPngDateString();
    await loadRebateTransactions();
  });

  btnRebateAllDates?.addEventListener("click", async () => {
    rebateListDate.value = "";
    await loadRebateTransactions();
  });

  btnLiveRefresh?.addEventListener("click", loadRebateReport);

  // init dates (PNG)
  const today = todayPngDateString();
  if (rebateDate) rebateDate.value = today;
  if (liveRebateDate) liveRebateDate.value = today;

  // Default rebate list date = today (PNG)
  if (rebateListDate) rebateListDate.value = today;

  // load data
  await loadRebateTransactions();
  await loadRebateReport();

  // realtime (keeps current filter)
  await startRealtime();
  onDashboardUpdated(async () => {
    await loadRebateTransactions();
  });
});

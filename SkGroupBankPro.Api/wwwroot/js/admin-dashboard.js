// wwwroot/js/admin-dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const $ = (id) => document.getElementById(id);

  // ----- Stats elements -----
  const statTotalCustomers = $("statTotalCustomers");
  const pillPngDate = $("pillPngDate");

  const statTodayDeposits = $("statTodayDeposits");
  const statTodayWithdrawals = $("statTodayWithdrawals");
  const statTodayProfit = $("statTodayProfit");
  const statTodayRebatesApproved = $("statTodayRebatesApproved");

  const statMtdDeposits = $("statMtdDeposits");
  const statMtdWithdrawals = $("statMtdWithdrawals");
  const statMtdProfit = $("statMtdProfit");
  const statActiveGames = $("statActiveGames");

  const statPendingDeposits = $("statPendingDeposits");
  const statPendingWithdrawals = $("statPendingWithdrawals");
  const statPendingRebates = $("statPendingRebates");

  // ----- Transactions elements -----
  const tbody = $("recentTbody");
  const btnRefresh = $("btnRefreshDashboard");

  const txSearch = $("txSearch");
  const txPrev = $("txPrev");
  const txNext = $("txNext");
  const txPageInfo = $("txPageInfo");
  const txCount = $("txCount");

  // ✅ New: timezone mode
  const tzMode = $("tzMode");

  let txPage = 1;
  const txPageSize = 25;
  let txMaxPage = 1;

  function money(x) {
    return Number(x || 0).toFixed(2);
  }

  function getTimeMode() {
    return (tzMode?.value || "png").toLowerCase(); // png | local | utc
  }

  // ✅ Always parse SAFE UTC first
  function parseUtc(utcString) {
    if (!utcString) return null;
    const d = new Date(utcString);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDateFromUtc(utcString) {
    const d = parseUtc(utcString);
    if (!d) return "";

    const mode = getTimeMode();

    if (mode === "utc") {
      return d.toLocaleString("en-GB", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }) + " UTC";
    }

    if (mode === "local") {
      // viewer local time
      return d.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }) + " Local";
    }

    // default PNG
    return d.toLocaleString("en-GB", {
      timeZone: "Pacific/Port_Moresby",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }) + " PNG";
  }

  async function loadStats() {
    const d = await apiFetch("/api/admin-dashboard/stats");

    statTotalCustomers.textContent = d.totalCustomers ?? 0;
    pillPngDate.textContent = "PNG: " + (d.pngDate ?? "-");

    statTodayDeposits.textContent = money(d.todayDeposits ?? 0);
    statTodayWithdrawals.textContent = money(d.todayWithdrawals ?? 0);
    statTodayProfit.textContent = money(d.todayProfit ?? 0);
    statTodayRebatesApproved.textContent = money(d.todayRebatesApproved ?? 0);

    statMtdDeposits.textContent = money(d.mtdDeposits ?? 0);
    statMtdWithdrawals.textContent = money(d.mtdWithdrawals ?? 0);
    statMtdProfit.textContent = money(d.mtdProfit ?? 0);

    statActiveGames.textContent = d.activeGames ?? 0;

    statPendingDeposits.textContent = d.pendingDeposits ?? 0;
    statPendingWithdrawals.textContent = d.pendingWithdrawals ?? 0;
    statPendingRebates.textContent = d.pendingRebates ?? 0;
  }

  function rowClassByStatus(statusName) {
    const s = String(statusName || "").toLowerCase();
    if (s === "pending") return "rowPending";
    if (s === "rejected") return "rowRejected";
    if (s === "approved") return "rowApproved";
    return "";
  }

  async function loadAllTransactions() {
    const q = (txSearch?.value || "").trim();

    const qs = new URLSearchParams();
    qs.set("page", String(txPage));
    qs.set("pageSize", String(txPageSize));
    if (q) qs.set("q", q);

    const res = await apiFetch(`/api/transactions/all?${qs.toString()}`);

    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);

    txMaxPage = Math.max(1, Math.ceil(total / txPageSize));

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${txPage} / ${txMaxPage}`;
    if (txPrev) txPrev.disabled = txPage <= 1;
    if (txNext) txNext.disabled = txPage >= txMaxPage;

    tbody.innerHTML = items.map(r => {
      const player = r.customerName ?? "N/A";
      const type = r.typeName ?? "";
      const status = r.statusName ?? "";
      const amount = r.amount ?? 0;

      // ✅ Use timezone-safe field
      const createdUtc = r.createdAtUtc ?? "";

      const cls = rowClassByStatus(status);

      return `
        <tr class="${cls}">
          <td>${escapeHtml(String(player))}</td>
          <td>${escapeHtml(String(type))}</td>
          <td class="right">${escapeHtml(money(amount))}</td>
          <td class="center">${escapeHtml(String(status))}</td>
          <td class="right">${escapeHtml(fmtDateFromUtc(createdUtc))}</td>
        </tr>
      `;
    }).join("");
  }

  async function refreshAll() {
    await loadStats();
    await loadAllTransactions();
  }

  // ---- Events ----
  btnRefresh?.addEventListener("click", async () => {
    txPage = 1;
    await refreshAll();
  });

  txPrev?.addEventListener("click", async () => {
    if (txPage > 1) {
      txPage--;
      await loadAllTransactions();
    }
  });

  txNext?.addEventListener("click", async () => {
    if (txPage < txMaxPage) {
      txPage++;
      await loadAllTransactions();
    }
  });

  let t = null;
  txSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      txPage = 1;
      await loadAllTransactions();
    }, 350);
  });

  // ✅ re-render dates immediately if user changes mode
  tzMode?.addEventListener("change", async () => {
    await loadAllTransactions();
  });

  // ---- Initial load ----
  await refreshAll();

  // ✅ Auto refresh every 30 seconds
  setInterval(() => {
    refreshAll().catch(() => {});
  }, 30000);

  // ✅ If SignalR helpers exist, refresh on push updates too
  try {
    if (typeof startRealtime === "function") {
      await startRealtime();
    }
    if (typeof onDashboardUpdated === "function") {
      onDashboardUpdated(() => refreshAll());
    }
  } catch {
    // ignore realtime failures
  }
});

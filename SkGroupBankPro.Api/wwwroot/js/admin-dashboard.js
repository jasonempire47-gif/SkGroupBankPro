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

  // ✅ Optional: timezone dropdown (png | local | utc)
  // If you do NOT have it in HTML, this stays null and defaults to PNG.
  const tzMode = $("tzMode");

  let txPage = 1;
  const txPageSize = 25;
  let txMaxPage = 1;

  // Prevent overlapping refresh calls
  let refreshing = false;

  function money(x) {
    const n = Number(x || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function getTimeMode() {
    return String(tzMode?.value || "png").toLowerCase(); // png | local | utc
  }

  function parseUtc(utcString) {
    if (!utcString) return null;
    const d = new Date(utcString);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtDateFromUtc(utcString) {
    const d = parseUtc(utcString);
    if (!d) return "";

    const mode = getTimeMode();

    // NOTE: use en-GB so it looks like 08/02/2026, 13:45:48
    if (mode === "utc") {
      return (
        d.toLocaleString("en-GB", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }) + " UTC"
      );
    }

    if (mode === "local") {
      return (
        d.toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }) + " Local"
      );
    }

    // Default: PNG time
    return (
      d.toLocaleString("en-GB", {
        timeZone: "Pacific/Port_Moresby",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }) + " PNG"
    );
  }

  function rowClassByStatus(statusName) {
    const s = String(statusName || "").toLowerCase();
    if (s === "pending") return "rowPending";
    if (s === "rejected") return "rowRejected";
    if (s === "approved") return "rowApproved";
    return "";
  }

  async function loadStats() {
    const d = await apiFetch("/api/admin-dashboard/stats");

    if (statTotalCustomers) statTotalCustomers.textContent = d.totalCustomers ?? 0;
    if (pillPngDate) pillPngDate.textContent = "PNG: " + (d.pngDate ?? "-");

    if (statTodayDeposits) statTodayDeposits.textContent = money(d.todayDeposits ?? 0);
    if (statTodayWithdrawals) statTodayWithdrawals.textContent = money(d.todayWithdrawals ?? 0);
    if (statTodayProfit) statTodayProfit.textContent = money(d.todayProfit ?? 0);
    if (statTodayRebatesApproved) statTodayRebatesApproved.textContent = money(d.todayRebatesApproved ?? 0);

    if (statMtdDeposits) statMtdDeposits.textContent = money(d.mtdDeposits ?? 0);
    if (statMtdWithdrawals) statMtdWithdrawals.textContent = money(d.mtdWithdrawals ?? 0);
    if (statMtdProfit) statMtdProfit.textContent = money(d.mtdProfit ?? 0);

    if (statActiveGames) statActiveGames.textContent = d.activeGames ?? 0;

    if (statPendingDeposits) statPendingDeposits.textContent = d.pendingDeposits ?? 0;
    if (statPendingWithdrawals) statPendingWithdrawals.textContent = d.pendingWithdrawals ?? 0;
    if (statPendingRebates) statPendingRebates.textContent = d.pendingRebates ?? 0;
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

    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="mutedSmall" style="padding:14px;">
            No records found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items
      .map((r) => {
        const player = r.customerName ?? "N/A";
        const type = r.typeName ?? "";
        const status = r.statusName ?? "";
        const amount = r.amount ?? 0;

        // ✅ timezone-safe field (your API must return createdAtUtc)
        const createdUtc = r.createdAtUtc ?? r.createdAt ?? "";

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
      })
      .join("");
  }

  async function refreshAll() {
    if (refreshing) return;
    refreshing = true;
    try {
      await loadStats();
      await loadAllTransactions();
    } finally {
      refreshing = false;
    }
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

  // Debounced search
  let t = null;
  txSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      txPage = 1;
      await loadAllTransactions();
    }, 350);
  });

  // ✅ re-render dates if user changes mode
  tzMode?.addEventListener("change", async () => {
    await loadAllTransactions();
  });

  // ---- Initial load ----
  await refreshAll();

  // ✅ Auto refresh every 30 seconds
  setInterval(() => {
    refreshAll().catch(() => {});
  }, 30000);

  // ✅ SignalR push refresh
  try {
    if (typeof startRealtime === "function") {
      await startRealtime();
    }
    if (typeof onDashboardUpdated === "function") {
      onDashboardUpdated(() => {
        // keep current page but refresh data
        refreshAll().catch(() => {});
      });
    }
  } catch {
    // ignore realtime failures
  }
});

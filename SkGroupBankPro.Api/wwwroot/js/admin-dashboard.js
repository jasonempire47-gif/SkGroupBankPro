// wwwroot/js/admin-dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const elTotalCustomers = document.getElementById("statTotalCustomers");
  const elActiveGames = document.getElementById("statActiveGames");
  const elPngPill = document.getElementById("pillPngDate");

  const elTodayDeposits = document.getElementById("statTodayDeposits");
  const elTodayWithdrawals = document.getElementById("statTodayWithdrawals");
  const elTodayProfit = document.getElementById("statTodayProfit");
  const elTodayRebatesApproved = document.getElementById("statTodayRebatesApproved");

  const elMtdDeposits = document.getElementById("statMtdDeposits");
  const elMtdWithdrawals = document.getElementById("statMtdWithdrawals");
  const elMtdProfit = document.getElementById("statMtdProfit");

  const elPendingDeposits = document.getElementById("statPendingDeposits");
  const elPendingWithdrawals = document.getElementById("statPendingWithdrawals");
  const elPendingRebates = document.getElementById("statPendingRebates");

  const recentTbody = document.getElementById("recentTbody");
  const btnRefresh = document.getElementById("btnRefreshDashboard");

  function fmt2(n) { return Number(n || 0).toFixed(2); }
  function fmtDate(val) {
    if (!val) return "";
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  }

  async function loadStats() {
    const stats = await apiFetch("/api/admin-dashboard/stats");

    elTotalCustomers && (elTotalCustomers.textContent = String(stats.totalCustomers ?? 0));
    elActiveGames && (elActiveGames.textContent = String(stats.activeGames ?? 0));
    elPngPill && (elPngPill.textContent = `PNG: ${stats.pngDate || "-"}`);

    elTodayDeposits && (elTodayDeposits.textContent = fmt2(stats.todayDeposits));
    elTodayWithdrawals && (elTodayWithdrawals.textContent = fmt2(stats.todayWithdrawals));
    elTodayProfit && (elTodayProfit.textContent = fmt2(stats.todayProfit));
    elTodayRebatesApproved && (elTodayRebatesApproved.textContent = fmt2(stats.todayRebatesApproved));

    elMtdDeposits && (elMtdDeposits.textContent = fmt2(stats.mtdDeposits));
    elMtdWithdrawals && (elMtdWithdrawals.textContent = fmt2(stats.mtdWithdrawals));
    elMtdProfit && (elMtdProfit.textContent = fmt2(stats.mtdProfit));

    elPendingDeposits && (elPendingDeposits.textContent = String(stats.pendingDeposits ?? 0));
    elPendingWithdrawals && (elPendingWithdrawals.textContent = String(stats.pendingWithdrawals ?? 0));
    elPendingRebates && (elPendingRebates.textContent = String(stats.pendingRebates ?? 0));
  }

  async function loadRecent() {
    const tx = await apiFetch("/api/transactions?take=50");
    const list = Array.isArray(tx) ? tx : [];
    const recent = list.slice(0, 15);

    if (!recentTbody) return;

    recentTbody.innerHTML = recent.map(r => `
      <tr>
        <td>${escapeHtml(r.customerName || "")}</td>
        <td>${escapeHtml(r.typeName || "")}</td>
        <td class="right">${escapeHtml(fmt2(r.amount))}</td>
        <td class="center">${escapeHtml(r.statusName || "")}</td>
        <td class="right">${escapeHtml(fmtDate(r.createdAt))}</td>
      </tr>
    `).join("");
  }

  async function refreshAll() {
    try {
      await Promise.all([loadStats(), loadRecent()]);
    } catch (e) {
      console.error(e);
    }
  }

  btnRefresh?.addEventListener("click", refreshAll);

  await refreshAll();

  // ✅ realtime refresh
  await startRealtime();
  onDashboardUpdated(() => refreshAll());
});

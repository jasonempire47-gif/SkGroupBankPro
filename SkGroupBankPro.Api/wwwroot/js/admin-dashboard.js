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

  let txPage = 1;
  const txPageSize = 25;
  let txMaxPage = 1;

  function money(x) {
    const n = Number(x || 0);
    return n.toFixed(2);
  }

  function fmtDate(x) {
    if (!x) return "";
    const d = new Date(x);
    if (isNaN(d.getTime())) return String(x);
    return d.toLocaleString();
  }

  async function loadStats() {
    // ✅ Your controller route is /api/admin-dashboard/stats
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

  async function loadAllTransactions() {
    const q = (txSearch?.value || "").trim();

    const qs = new URLSearchParams();
    qs.set("page", String(txPage));
    qs.set("pageSize", String(txPageSize));
    if (q) qs.set("q", q);

    // ✅ Your API works: /api/transactions/all?page=1&pageSize=25
    const res = await apiFetch(`/api/transactions/all?${qs.toString()}`);

    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);

    txMaxPage = Math.max(1, Math.ceil(total / txPageSize));

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${txPage} / ${txMaxPage}`;
    if (txPrev) txPrev.disabled = txPage <= 1;
    if (txNext) txNext.disabled = txPage >= txMaxPage;

    // ✅ Match your returned fields: customerName / typeName / statusName / amount / createdAt
    tbody.innerHTML = items.map(r => {
      const player = r.customerName ?? "N/A";
      const type = r.typeName ?? "";
      const status = r.statusName ?? "";
      const amount = r.amount ?? 0;
      const created = r.createdAt ?? "";

      return `
        <tr>
          <td>${escapeHtml(String(player))}</td>
          <td>${escapeHtml(String(type))}</td>
          <td class="right">${escapeHtml(money(amount))}</td>
          <td class="center">${escapeHtml(String(status))}</td>
          <td class="right">${escapeHtml(fmtDate(created))}</td>
        </tr>
      `;
    }).join("");
  }

  // ---- Events ----
  btnRefresh?.addEventListener("click", async () => {
    txPage = 1;
    await loadStats();
    await loadAllTransactions();
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

  // ---- Initial load ----
  await loadStats();
  await loadAllTransactions();
});

// wwwroot/js/staff-all-transactions.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const tbody = $("txTbody");
  const txFilter = $("txFilter");
  const btnRefreshTx = $("btnRefreshTx");

  const txSearch = $("txSearch");
  const txPrev = $("txPrev");
  const txNext = $("txNext");
  const txPageInfo = $("txPageInfo");
  const txCount = $("txCount");

  let page = 1;
  const pageSize = 25;

  function money(x) {
    const n = Number(x || 0);
    return n.toFixed(2);
  }

  // ✅ Render time in PNG (Port Moresby)
  function fmtDate(utcString) {
    if (!utcString) return "-";
    const d = new Date(utcString);
    if (isNaN(d.getTime())) return String(utcString);

    return d.toLocaleString("en-GB", {
      timeZone: "Pacific/Port_Moresby",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function buildQuery() {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    const q = (txSearch?.value || "").trim();
    if (q) qs.set("q", q);

    // NOTE: your backend currently filters pending via "q" (status search),
    // not via a "status=pending" query param.
    const filter = (txFilter?.value || "all").toLowerCase();
    if (filter === "pending") qs.set("q", "pending");

    return qs.toString();
  }

  async function loadAll() {
    const res = await apiFetch(`/api/transactions/all?${buildQuery()}`);

    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);
    const maxPage = Math.max(1, Math.ceil(total / pageSize));

    tbody.innerHTML = items
      .map((r) => {
        const id = r.id ?? "";
        const customer = r.customerName ?? "N/A";
        const type = r.typeName ?? "";
        const game = r.gameTypeName ?? "";
        const amount = r.amount ?? 0;
        const status = r.statusName ?? "";
        const bank = r.bankType ?? "";
        const createdUtc = r.createdAtUtc ?? r.createdAt ?? "";

        const actionsHtml = `
          <button class="btn ghost btnEditTx" data-id="${escapeHtml(String(id))}" type="button">Edit</button>
        `;

        return `
          <tr>
            <td>${escapeHtml(String(id))}</td>
            <td>${escapeHtml(String(customer))}</td>
            <td>${escapeHtml(String(type))}</td>
            <td>${escapeHtml(String(game))}</td>
            <td class="right">${escapeHtml(money(amount))}</td>
            <td>${escapeHtml(String(status))}</td>
            <td>${escapeHtml(String(bank))}</td>
            <td>${escapeHtml(fmtDate(createdUtc))}</td>
            <td>${actionsHtml}</td>
          </tr>
        `;
      })
      .join("");

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${page} / ${maxPage}`;
    if (txPrev) txPrev.disabled = page <= 1;
    if (txNext) txNext.disabled = page >= maxPage;
  }

  // Paging
  txPrev?.addEventListener("click", async () => {
    if (page > 1) {
      page--;
      await loadAll();
    }
  });

  txNext?.addEventListener("click", async () => {
    page++;
    await loadAll();
  });

  // Refresh + filter
  btnRefreshTx?.addEventListener("click", async () => {
    page = 1;
    await loadAll();
  });

  txFilter?.addEventListener("change", async () => {
    page = 1;
    await loadAll();
  });

  // Search debounce
  let t = null;
  txSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      page = 1;
      await loadAll();
    }, 350);
  });

  // Initial
  loadAll();
});

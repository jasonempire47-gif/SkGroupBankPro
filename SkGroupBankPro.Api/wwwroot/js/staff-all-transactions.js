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

  function fmtDate(x) {
    const d = new Date(x);
    if (isNaN(d)) return escapeHtml(String(x ?? ""));
    return d.toLocaleString();
  }

  function buildQuery() {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    const q = (txSearch?.value || "").trim();
    if (q) qs.set("q", q);

    const filter = (txFilter?.value || "all").toLowerCase();
    if (filter === "pending") qs.set("status", "pending");

    return qs.toString();
  }

  async function loadAll() {
    const res = await apiFetch(`/api/transactions/all?${buildQuery()}`);

    const items = res.items || [];
    const total = res.total || 0;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));

    tbody.innerHTML = items.map(r => {
      const id = r.id ?? "";
      const customer = r.customer ?? "N/A";
      const type = r.type ?? "";
      const game = r.game ?? "";
      const amount = r.amount ?? 0;
      const status = r.status ?? "";
      const bank = r.bank ?? "";
      const createdAt = r.createdAt ?? "";

      // Actions column: keep placeholder so your existing staff.js edit handlers can still work if they are delegated by row/id
      // If your staff.js uses buttons with specific classes/attributes, update here to match.
      const actionsHtml = `
        <button class="btn ghost btnEditTx" data-id="${escapeHtml(String(id))}" type="button">Edit</button>
      `;

      return `
        <tr>
          <td>${escapeHtml(String(id))}</td>
          <td>${escapeHtml(customer)}</td>
          <td>${escapeHtml(type)}</td>
          <td>${escapeHtml(game)}</td>
          <td class="right">${money(amount)}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(bank)}</td>
          <td>${escapeHtml(fmtDate(createdAt))}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join("");

    txCount.textContent = `${total} record(s)`;
    txPageInfo.textContent = `Page ${page} / ${maxPage}`;

    txPrev.disabled = page <= 1;
    txNext.disabled = page >= maxPage;
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

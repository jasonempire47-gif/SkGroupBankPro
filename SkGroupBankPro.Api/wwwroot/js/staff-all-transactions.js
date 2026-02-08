// wwwroot/js/staff-all-transactions.js
document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

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
  let maxPage = 1;

  function money(x) {
    const n = Number(x || 0);
    return n.toFixed(2);
  }

  // ✅ Date: show PNG time from createdAtUtc
  function fmtDatePng(utcString) {
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

  function canEdit() {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    // ✅ backend allows edit only for Admin/Finance now
    return role.includes("admin") || role.includes("finance");
  }

  function buildQuery() {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    const q = (txSearch?.value || "").trim();
    const filter = (txFilter?.value || "all").toLowerCase();

    if (filter === "pending") {
      const merged = q ? `${q} pending` : "pending";
      qs.set("q", merged);
    } else {
      if (q) qs.set("q", q);
    }

    return qs.toString();
  }

  async function loadAll() {
    const res = await apiFetch(`/api/transactions/all?${buildQuery()}`);

    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);

    maxPage = Math.max(1, Math.ceil(total / pageSize));

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${page} / ${maxPage}`;
    if (txPrev) txPrev.disabled = page <= 1;
    if (txNext) txNext.disabled = page >= maxPage;

    const showEdit = canEdit();

    tbody.innerHTML = items.map(r => {
      const id = r.id ?? "";
      const customer = r.customerName ?? "N/A";
      const type = r.typeName ?? "";
      const game = r.gameTypeName ?? "";
      const amount = r.amount ?? 0;
      const status = r.statusName ?? "";
      const bank = r.bankType ?? "";
      const createdUtc = r.createdAtUtc ?? "";

      const actionsHtml = showEdit
        ? `<button class="btn ghost btnEditTx" data-id="${escapeHtml(String(id))}" type="button">Edit</button>`
        : `<span class="mutedSmall">—</span>`;

      return `
        <tr>
          <td>${escapeHtml(String(id))}</td>
          <td>${escapeHtml(String(customer))}</td>
          <td>${escapeHtml(String(type))}</td>
          <td>${escapeHtml(String(game))}</td>
          <td class="right">${escapeHtml(money(amount))}</td>
          <td>${escapeHtml(String(status))}</td>
          <td>${escapeHtml(String(bank))}</td>
          <td class="right">${escapeHtml(fmtDatePng(createdUtc))}</td>
          <td class="center">${actionsHtml}</td>
        </tr>
      `;
    }).join("");
  }

  // Paging
  txPrev?.addEventListener("click", async () => {
    if (page > 1) {
      page--;
      await loadAll();
    }
  });

  txNext?.addEventListener("click", async () => {
    if (page < maxPage) {
      page++;
      await loadAll();
    }
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

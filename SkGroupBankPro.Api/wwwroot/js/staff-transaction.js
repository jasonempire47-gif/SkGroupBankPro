// wwwroot/js/staff-transactions.js
document.addEventListener("DOMContentLoaded", () => {
  let page = 1;
  const pageSize = 25;

  const elBody = document.querySelector("#staffTxTable tbody");
  const elSearch = document.getElementById("staffTxSearch");
  const elPrev = document.getElementById("staffTxPrev");
  const elNext = document.getElementById("staffTxNext");
  const elInfo = document.getElementById("staffTxPageInfo");
  const elCount = document.getElementById("staffTxCount");
  const btnRefresh = document.getElementById("btnStaffTxRefresh");

  function fmtMoney(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  function fmtDate(isoOrDate) {
    const d = new Date(isoOrDate);
    if (isNaN(d)) return escapeHtml(String(isoOrDate ?? ""));
    return d.toLocaleString();
  }

  async function load() {
    const q = (elSearch?.value || "").trim();

    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q) qs.set("q", q);

    const res = await apiFetch(`/api/transactions/all?${qs.toString()}`);
    const items = res.items || [];
    const total = res.total || 0;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));

    elBody.innerHTML = items.map(r => `
      <tr>
        <td>${escapeHtml(r.player)}</td>
        <td>${escapeHtml(r.type)}</td>
        <td style="text-align:right;">${fmtMoney(r.amount)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td style="text-align:right;">${fmtDate(r.createdAt)}</td>
      </tr>
    `).join("");

    elCount.textContent = `${total} record(s)`;
    elInfo.textContent = `Page ${page} / ${maxPage}`;
    elPrev.disabled = page <= 1;
    elNext.disabled = page >= maxPage;
  }

  elPrev?.addEventListener("click", async () => {
    if (page > 1) { page--; await load(); }
  });

  elNext?.addEventListener("click", async () => {
    page++;
    await load();
  });

  btnRefresh?.addEventListener("click", async () => {
    page = 1;
    await load();
  });

  let t = null;
  elSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      page = 1;
      await load();
    }, 350);
  });

  load();
});

// wwwroot/js/finance.js
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const $ = (id) => document.getElementById(id);

  // ============ BANK SUMMARY (localStorage) ============
  const bankTbody = $("bankTbody");
  const bankSearch = $("bankSearch");
  const btnAddBank = $("btnAddBank");
  const btnRefreshFinance = $("btnRefreshFinance");
  const bankCount = $("bankCount");

  // ============ TRANSACTIONS ============
  const txTbody = $("txTbody");
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

  // ============ MODAL ============
  const modalBackdrop = $("modalBackdrop");
  const modalTitle = $("modalTitle");
  const modalBody = $("modalBody");
  const btnModalCancel = $("btnModalCancel");
  const btnModalSave = $("btnModalSave");

  let modalOnSave = null;

  function openModal(title, bodyHtml, onSave) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalOnSave = onSave;
    modalBackdrop.style.display = "grid";
  }

  function closeModal() {
    modalBackdrop.style.display = "none";
    modalBody.innerHTML = "";
    modalOnSave = null;
  }

  btnModalCancel?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  btnModalSave?.addEventListener("click", async () => {
    if (!modalOnSave) return;
    btnModalSave.disabled = true;
    try {
      await modalOnSave();
      closeModal();
    } finally {
      btnModalSave.disabled = false;
    }
  });

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

  // ----------------------------
  // BANK STORE (localStorage)
  // ----------------------------
  const BANK_KEY = "BANKPRO_BANKS_V1";

  function loadBanks() {
    try {
      const raw = localStorage.getItem(BANK_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveBanks(banks) {
    localStorage.setItem(BANK_KEY, JSON.stringify(banks));
  }

  function normalizeBankName(x) {
    return String(x || "").trim();
  }

  function upsertBank(banks, name, patch) {
    const n = normalizeBankName(name);
    const i = banks.findIndex(b => (b.name || "").toLowerCase() === n.toLowerCase());
    if (i >= 0) {
      banks[i] = { ...banks[i], ...patch, name: banks[i].name || n };
    } else {
      banks.push({
        name: n,
        accountName: "",
        accountNo: "",
        opening: 0,
        ...patch
      });
    }
    return banks;
  }

  // ----------------------------
  // TRANSACTIONS -> BANK TOTALS
  // Approved Net = sum(approved deposits+bonus) - sum(approved withdrawals)
  // ----------------------------
  function computeApprovedNetByBank(items) {
    const map = new Map(); // bankName -> net
    for (const r of items) {
      const status = String(r.statusName || "").toLowerCase();
      if (status !== "approved") continue;

      const bank = String(r.bankType || "").trim() || "—";
      const type = String(r.typeName || "").toLowerCase();
      const amt = Number(r.amount || 0);

      let sign = 0;
      if (type.includes("withdraw")) sign = -1;
      else sign = +1; // deposit/bonus credit

      map.set(bank, (map.get(bank) || 0) + sign * amt);
    }
    return map;
  }

  async function fetchAllApprovedForBankSummary() {
    // For bank summary we can just pull first N pages if needed.
    // Keep it simple: fetch first 200 rows (max pageSize = 200).
    const res = await apiFetch(`/api/transactions/all?page=1&pageSize=200`);
    const items = Array.isArray(res?.items) ? res.items : [];
    return items;
  }

  async function renderBanks() {
    const q = (bankSearch?.value || "").trim().toLowerCase();

    const approvedItems = await fetchAllApprovedForBankSummary();
    const netMap = computeApprovedNetByBank(approvedItems);

    let banks = loadBanks();

    // auto-add any bank names seen in transactions (so table is not empty)
    for (const [bankName] of netMap.entries()) {
      banks = upsertBank(banks, bankName, {});
    }
    saveBanks(banks);

    const filtered = banks.filter(b => {
      if (!q) return true;
      const s = `${b.name} ${b.accountName} ${b.accountNo}`.toLowerCase();
      return s.includes(q);
    });

    bankTbody.innerHTML = filtered.map((b, idx) => {
      const name = b.name || "—";
      const accountName = b.accountName || "";
      const accountNo = b.accountNo || "";
      const opening = Number(b.opening || 0);
      const approvedNet = Number(netMap.get(name) || 0);
      const balance = opening + approvedNet;

      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${escapeHtml(accountName)}</td>
          <td>${escapeHtml(accountNo)}</td>
          <td class="right">${escapeHtml(money(opening))}</td>
          <td class="right">${escapeHtml(money(approvedNet))}</td>
          <td class="right"><strong>${escapeHtml(money(balance))}</strong></td>
          <td class="center">
            <button class="btn ghost btnEditBank" data-name="${escapeHtml(name)}" type="button">Edit</button>
            <button class="btn ghost btnDeleteBank" data-name="${escapeHtml(name)}" type="button">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    if (bankCount) bankCount.textContent = `${filtered.length} bank(s)`;
  }

  function openBankEditor(bankName) {
    const banks = loadBanks();
    const b = banks.find(x => (x.name || "").toLowerCase() === String(bankName || "").toLowerCase()) || {
      name: bankName || "",
      accountName: "",
      accountNo: "",
      opening: 0
    };

    openModal(
      "Edit Bank",
      `
        <div class="formGrid">
          <label class="formLabel">Bank</label>
          <input id="mBankName" class="formInput" value="${escapeHtml(b.name || "")}" placeholder="Bank name"/>

          <label class="formLabel">Account Name</label>
          <input id="mAccName" class="formInput" value="${escapeHtml(b.accountName || "")}" placeholder="Account name"/>

          <label class="formLabel">Account No.</label>
          <input id="mAccNo" class="formInput" value="${escapeHtml(b.accountNo || "")}" placeholder="Account number"/>

          <label class="formLabel">Opening Balance</label>
          <input id="mOpening" class="formInput" type="number" step="0.01" value="${Number(b.opening || 0)}"/>
        </div>
        <div class="mutedSmall" style="margin-top:10px;">
          Saved locally in this browser (Render free plan has no disk).
        </div>
      `,
      async () => {
        const name = ($("mBankName")?.value || "").trim();
        if (!name) throw new Error("Bank name required.");

        const patch = {
          accountName: ($("mAccName")?.value || "").trim(),
          accountNo: ($("mAccNo")?.value || "").trim(),
          opening: Number($("mOpening")?.value || 0)
        };

        let list = loadBanks();

        // handle rename: remove old if name changed
        const oldNameLower = (b.name || "").toLowerCase();
        const newNameLower = name.toLowerCase();
        if (oldNameLower && oldNameLower !== newNameLower) {
          list = list.filter(x => (x.name || "").toLowerCase() !== oldNameLower);
        }

        list = upsertBank(list, name, patch);
        saveBanks(list);
        await renderBanks();
      }
    );
  }

  btnAddBank?.addEventListener("click", () => openBankEditor(""));

  bankSearch?.addEventListener("input", () => {
    // fast client-side filter; re-render uses computed totals too
    renderBanks().catch(() => {});
  });

  // bank actions (delegated)
  bankTbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const name = btn.getAttribute("data-name") || "";
    if (btn.classList.contains("btnEditBank")) {
      openBankEditor(name);
      return;
    }
    if (btn.classList.contains("btnDeleteBank")) {
      const banks = loadBanks().filter(x => (x.name || "").toLowerCase() !== name.toLowerCase());
      saveBanks(banks);
      await renderBanks();
      return;
    }
  });

  // ============ TRANSACTIONS ============
  function buildTxQuery() {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));

    const q = (txSearch?.value || "").trim();
    const filter = (txFilter?.value || "all").toLowerCase();

    // If pending filter, enforce q contains pending (backend filters by q only)
    if (filter === "pending") {
      const merged = q ? `${q} pending` : "pending";
      qs.set("q", merged);
    } else {
      if (q) qs.set("q", q);
    }

    return qs.toString();
  }

  function statusBadge(statusName) {
    const s = String(statusName || "").toLowerCase();
    if (s === "approved") return `<span class="badge ok">Approved</span>`;
    if (s === "pending") return `<span class="badge warn">Pending</span>`;
    if (s === "rejected") return `<span class="badge bad">Rejected</span>`;
    return `<span class="badge">${escapeHtml(statusName || "-")}</span>`;
  }

  function actionsHtmlForTx(r) {
    const id = r.id;
    const status = String(r.statusName || "").toLowerCase();

    // Always allow Edit (finance correction)
    const editBtn = `<button class="btn ghost btnEditTx" data-id="${id}" type="button">Edit</button>`;

    if (status === "pending") {
      return `
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn ghost btnApproveTx" data-id="${id}" type="button">Approve</button>
          <button class="btn ghost btnRejectTx" data-id="${id}" type="button">Reject</button>
          ${editBtn}
        </div>
      `;
    }

    return `
      <div style="display:flex; gap:8px; justify-content:center;">
        ${editBtn}
      </div>
    `;
  }

  async function loadTransactions() {
    const res = await apiFetch(`/api/transactions/all?${buildTxQuery()}`);
    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);

    maxPage = Math.max(1, Math.ceil(total / pageSize));

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${page} / ${maxPage}`;
    if (txPrev) txPrev.disabled = page <= 1;
    if (txNext) txNext.disabled = page >= maxPage;

    txTbody.innerHTML = items.map(r => {
      const id = r.id ?? "";
      const customer = r.customerName ?? "N/A";
      const type = r.typeName ?? "";
      const game = r.gameTypeName ?? "";
      const amount = r.amount ?? 0;
      const statusName = r.statusName ?? "";
      const bank = r.bankType ?? "";
      const ref = r.referenceNo ?? "";
      const createdUtc = r.createdAtUtc ?? "";

      return `
        <tr>
          <td>${escapeHtml(String(id))}</td>
          <td>${escapeHtml(String(customer))}</td>
          <td>${escapeHtml(String(type))}</td>
          <td>${escapeHtml(String(game))}</td>
          <td class="right">${escapeHtml(money(amount))}</td>
          <td>${statusBadge(statusName)}</td>
          <td>${escapeHtml(String(bank))}</td>
          <td>${escapeHtml(String(ref))}</td>
          <td class="right">${escapeHtml(fmtDatePng(createdUtc))}</td>
          <td class="center">${actionsHtmlForTx(r)}</td>
        </tr>
      `;
    }).join("");
  }

  async function refreshAll() {
    await Promise.all([
      renderBanks(),
      loadTransactions()
    ]);
  }

  // Paging
  txPrev?.addEventListener("click", async () => {
    if (page > 1) {
      page--;
      await loadTransactions();
    }
  });

  txNext?.addEventListener("click", async () => {
    if (page < maxPage) {
      page++;
      await loadTransactions();
    }
  });

  btnRefreshTx?.addEventListener("click", async () => {
    page = 1;
    await loadTransactions();
  });

  txFilter?.addEventListener("change", async () => {
    page = 1;
    await loadTransactions();
  });

  let t = null;
  txSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      page = 1;
      await loadTransactions();
    }, 350);
  });

  btnRefreshFinance?.addEventListener("click", async () => {
    await refreshAll();
  });

  // Tx actions (delegated)
  txTbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = Number(btn.getAttribute("data-id") || 0);
    if (!id) return;

    if (btn.classList.contains("btnApproveTx")) {
      btn.disabled = true;
      try {
        await apiFetch(`/api/transactions/${id}/approve`, { method: "PATCH" });
        await refreshAll();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (btn.classList.contains("btnRejectTx")) {
      openModal(
        `Reject Transaction #${id}`,
        `
          <div class="formGrid">
            <label class="formLabel">Reason</label>
            <input id="mRejectReason" class="formInput" placeholder="Reason (optional)"/>
          </div>
          <div class="mutedSmall" style="margin-top:10px;">This will set status to Rejected.</div>
        `,
        async () => {
          const reason = ($("mRejectReason")?.value || "").trim();
          await apiFetch(`/api/transactions/${id}/reject`, {
            method: "PATCH",
            body: JSON.stringify({ reason })
          });
          await refreshAll();
        }
      );
      return;
    }

    if (btn.classList.contains("btnEditTx")) {
      // Pull row data by re-fetching page and finding item (simple & safe)
      const res = await apiFetch(`/api/transactions/all?${buildTxQuery()}`);
      const items = Array.isArray(res?.items) ? res.items : [];
      const r = items.find(x => Number(x.id) === id);

      if (!r) {
        alert("Transaction not found in current page. Refresh and try again.");
        return;
      }

      openModal(
        `Edit Transaction #${id}`,
        `
          <div class="formGrid">
            <label class="formLabel">Amount</label>
            <input id="mAmt" class="formInput" type="number" step="0.01" value="${Number(r.amount || 0)}"/>

            <label class="formLabel">Bank Type</label>
            <input id="mBank" class="formInput" value="${escapeHtml(r.bankType || "")}" placeholder="e.g. BSP"/>

            <label class="formLabel">Reference No.</label>
            <input id="mRef" class="formInput" value="${escapeHtml(r.referenceNo || "")}" placeholder="Reference"/>

            <label class="formLabel">Game Type (ID)</label>
            <input id="mGameId" class="formInput" type="number" value="${r.gameTypeId ?? ""}" placeholder="optional"/>

            <label class="formLabel">Notes</label>
            <input id="mNotes" class="formInput" value="${escapeHtml(r.notes || "")}" placeholder="Notes"/>
          </div>
          <div class="mutedSmall" style="margin-top:10px;">
            This updates the existing record (for finance corrections).
          </div>
        `,
        async () => {
          const amount = Number(($("mAmt")?.value || 0));
          const bankType = ($("mBank")?.value || "").trim();
          const referenceNo = ($("mRef")?.value || "").trim();
          const notes = ($("mNotes")?.value || "").trim();
          const gameRaw = ($("mGameId")?.value || "").trim();
          const gameTypeId = gameRaw ? Number(gameRaw) : null;

          if (!amount || amount <= 0) throw new Error("Amount must be > 0.");
          if (!bankType) throw new Error("Bank Type is required.");

          await apiFetch(`/api/transactions/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              amount,
              bankType,
              referenceNo,
              notes,
              gameTypeId
            })
          });

          await refreshAll();
        }
      );

      return;
    }
  });

  // ====== Minimal modal styling using existing theme ======
  // (If you already have modal CSS, you can remove this)
  const style = document.createElement("style");
  style.textContent = `
    .modalBackdrop{
      position: fixed; inset: 0;
      display:grid; place-items:center;
      background: rgba(0,0,0,.55);
      z-index: 9999;
      padding: 18px;
    }
    .modalCard{
      width: min(560px, 96vw);
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(18,18,20,.82);
      backdrop-filter: blur(12px);
      box-shadow: 0 18px 60px rgba(0,0,0,.65);
      padding: 14px;
    }
    .modalTitle{
      font-weight: 900;
      color: #f2c200;
      margin: 4px 4px 10px;
    }
    .modalBody{ padding: 6px 4px 10px; }
    .modalActions{
      display:flex; justify-content:flex-end; gap:10px;
      padding: 6px 4px 2px;
    }
    .formGrid{
      display:grid;
      grid-template-columns: 140px 1fr;
      gap:10px;
      align-items:center;
    }
    .formLabel{ color: rgba(255,255,255,.70); font-size: 13px; font-weight: 800; }
    .formInput{
      height: 34px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.92);
      padding: 0 12px;
      outline: none;
    }
    .badge.ok{ border-color: rgba(46,204,113,.30); background: rgba(46,204,113,.12); }
    .badge.warn{ border-color: rgba(243,156,18,.30); background: rgba(243,156,18,.12); }
    .badge.bad{ border-color: rgba(231,76,60,.30); background: rgba(231,76,60,.12); }
  `;
  document.head.appendChild(style);

  // ============ REALTIME AUTO-REFRESH ============
  async function wireRealtime() {
    try {
      if (typeof startRealtime === "function") await startRealtime();
      if (typeof onDashboardUpdated === "function") {
        onDashboardUpdated(() => {
          // refresh only transactions + banks
          refreshAll().catch(() => {});
        });
      }
    } catch {
      // ignore
    }
  }

  // Initial load
  await refreshAll();
  await wireRealtime();

  // Auto refresh every 30s (free Render can sleep; this also helps UI recover)
  setInterval(() => refreshAll().catch(() => {}), 30000);
});

// wwwroot/js/staff.js
document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const role = (localStorage.getItem("role") || "").trim();
  const canApproveReject = role === "Admin" || role === "Finance" || role === "Staff";
  const canEdit = role === "Admin" || role === "Finance" || role === "Staff";

  // Elements
  const txTbody = document.getElementById("txTbody");
  const txFilter = document.getElementById("txFilter");
  const btnRefreshTx = document.getElementById("btnRefreshTx");

  // ✅ NEW: search + paging elements (must exist in staff.html)
  const txSearch = document.getElementById("txSearch");
  const txPrev = document.getElementById("txPrev");
  const txNext = document.getElementById("txNext");
  const txPageInfo = document.getElementById("txPageInfo");
  const txCount = document.getElementById("txCount");

  const btnCreateCustomer = document.getElementById("btnCreateCustomer");
  const cName = document.getElementById("cName");
  const cPhone = document.getElementById("cPhone");
  const createCustomerMsg = document.getElementById("createCustomerMsg");

  const customerSelect = document.getElementById("customerSelect");
  const txKind = document.getElementById("txKind");
  const gameTypeSelect = document.getElementById("gameTypeSelect");
  const bankType = document.getElementById("bankType");
  const referenceNo = document.getElementById("referenceNo");
  const amount = document.getElementById("amount");
  const notes = document.getElementById("notes");
  const createdAtUtc = document.getElementById("createdAtUtc");
  const btnSubmitTx = document.getElementById("btnSubmitTx");
  const txMsg = document.getElementById("txMsg");

  // Modal elements
  const editModal = document.getElementById("editModal");
  const btnEditClose = document.getElementById("btnEditClose");
  const btnEditCancel = document.getElementById("btnEditCancel");
  const btnEditSave = document.getElementById("btnEditSave");
  const editModalErr = document.getElementById("editModalErr");
  const editModalSub = document.getElementById("editModalSub");

  const editAmount = document.getElementById("editAmount");
  const editBankType = document.getElementById("editBankType");
  const editGameType = document.getElementById("editGameType");
  const editRef = document.getElementById("editRef");
  const editNotes = document.getElementById("editNotes");

  // PNG time
  const PNG_TZ = "Pacific/Port_Moresby";
  const PNG_OFFSET_MIN = 10 * 60;

  // State
  let allGameTypes = [];         // from /api/game-types
  let editRow = null;            // currently editing transaction row

  // ✅ Paging state
  let txPage = 1;
  const txPageSize = 25;
  let txMaxPage = 1;

  function setMsg(el, text, ok = true) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "#8ef0b7" : "#ff8b8b";
  }

  function fmt2(n) { return Number(n || 0).toFixed(2); }

  function fmtDate(val) {
    if (!val) return "";
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  }

  function getPngNowDateTimeLocalString() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: PNG_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date());

    const map = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  }

  function setPngNowToInput() {
    if (!createdAtUtc) return;
    createdAtUtc.value = getPngNowDateTimeLocalString();
  }

  function pngLocalInputToUtcIso(pngLocalStr) {
    if (!pngLocalStr || !pngLocalStr.includes("T")) return null;

    const [dPart, tPart] = pngLocalStr.split("T");
    const [Y, M, D] = dPart.split("-").map(Number);
    const [hh, mm] = tPart.split(":").map(Number);
    if (!Y || !M || !D) return null;

    const utc = new Date(Date.UTC(Y, M - 1, D, hh, mm, 0, 0));
    utc.setUTCMinutes(utc.getUTCMinutes() - PNG_OFFSET_MIN);
    return utc.toISOString();
  }

  function openEditModal(row) {
    editRow = row;
    if (!editModal) return;

    setMsg(editModalErr, "", true);

    const title = `Editing #${row.id} • ${row.customerName || ""} • ${row.typeName || ""}`;
    if (editModalSub) editModalSub.textContent = title;

    editAmount.value = Number(row.amount || 0);
    editBankType.value = (row.bankType || "").trim() || "";
    editRef.value = (row.referenceNo || "");
    editNotes.value = (row.notes || "");

    renderEditGameTypeOptions(row.gameTypeId);

    editModal.style.display = "flex";
    setTimeout(() => editAmount?.focus(), 0);
  }

  function closeEditModal() {
    if (!editModal) return;
    editModal.style.display = "none";
    editRow = null;
  }

  function renderEditGameTypeOptions(currentGameTypeId) {
    if (!editGameType) return;

    const options = [
      `<option value="">Keep current</option>`,
      ...allGameTypes.map(g => `<option value="${g.id}">${escapeHtml(g.name || "")}</option>`)
    ];
    editGameType.innerHTML = options.join("");

    editGameType.value = "";
  }

  async function saveEditModal() {
    if (!editRow) return;

    setMsg(editModalErr, "", true);

    const newAmount = Number(editAmount.value || 0);
    if (!newAmount || newAmount <= 0) return setMsg(editModalErr, "Amount must be > 0.", false);

    const newBank = (editBankType.value || "").trim();
    if (!newBank) return setMsg(editModalErr, "Bank Type is required.", false);

    const newRef = (editRef.value || "").trim();
    const newNotes = (editNotes.value || "").trim();

    const gameTypeChoice = (editGameType.value || "").trim();
    const gameTypeId =
      gameTypeChoice === ""
        ? (editRow.gameTypeId ?? null)
        : Number(gameTypeChoice);

    if (gameTypeChoice !== "" && (!gameTypeId || gameTypeId <= 0))
      return setMsg(editModalErr, "Invalid Game Type.", false);

    btnEditSave.disabled = true;
    try {
      await apiFetch(`/api/transactions/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: newAmount,
          bankType: newBank,
          referenceNo: newRef,
          notes: newNotes,
          gameTypeId
        })
      });

      closeEditModal();
      await loadAllTransactions(); // ✅ reload paged list
    } catch (e) {
      setMsg(editModalErr, String(e?.message || e), false);
    } finally {
      btnEditSave.disabled = false;
    }
  }

  // Modal events
  btnEditClose?.addEventListener("click", closeEditModal);
  btnEditCancel?.addEventListener("click", closeEditModal);
  btnEditSave?.addEventListener("click", saveEditModal);

  editModal?.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editModal?.style.display === "flex") closeEditModal();
  });

  async function loadCustomers(selectIdToKeep = null) {
    const customers = await apiFetch("/api/customers");
    const list = Array.isArray(customers) ? customers : [];

    const current = selectIdToKeep ?? customerSelect?.value ?? "";
    customerSelect.innerHTML = list
      .map(c => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`)
      .join("");

    if (current) {
      const exists = list.some(x => String(x.id) === String(current));
      if (exists) customerSelect.value = String(current);
    }
  }

  async function loadGameTypes() {
    const games = await apiFetch("/api/game-types");
    allGameTypes = Array.isArray(games) ? games : [];

    gameTypeSelect.innerHTML =
      `<option value="">Game Type (optional)</option>` +
      allGameTypes.map(g => `<option value="${g.id}">${escapeHtml(g.name || "")}</option>`).join("");

    renderEditGameTypeOptions(null);
  }

  async function createCustomer() {
    setMsg(createCustomerMsg, "", true);

    const name = (cName?.value || "").trim();
    const phone = (cPhone?.value || "").trim();
    if (!name) return setMsg(createCustomerMsg, "Customer name is required.", false);

    btnCreateCustomer.disabled = true;
    try {
      const created = await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name, phone })
      });

      setMsg(createCustomerMsg, `Created customer: ${created?.name || name}`, true);

      cName.value = "";
      cPhone.value = "";

      await loadCustomers(String(created?.id || ""));
      txPage = 1;
      await loadAllTransactions();
    } catch (e) {
      setMsg(createCustomerMsg, String(e?.message || e), false);
    } finally {
      btnCreateCustomer.disabled = false;
    }
  }

  async function submitTx() {
    setMsg(txMsg, "", true);

    const customerId = Number(customerSelect?.value || 0);
    if (!customerId) return setMsg(txMsg, "Please select a customer.", false);

    const kind = (txKind?.value || "deposit").toLowerCase();

    const bank = (bankType?.value || "").trim();
    if (!bank) return setMsg(txMsg, "Bank Type is required.", false);

    const amt = Number(amount?.value || 0);
    if (!amt || amt <= 0) return setMsg(txMsg, "Amount must be greater than 0.", false);

    const gameTypeIdRaw = (gameTypeSelect?.value || "").trim();
    const gameTypeId = gameTypeIdRaw ? Number(gameTypeIdRaw) : null;

    const pngLocalStr = (createdAtUtc?.value || "").trim();
    const createdAtUtcIso = pngLocalInputToUtcIso(pngLocalStr);
    if (!createdAtUtcIso) return setMsg(txMsg, "Date/time invalid. Please refresh.", false);

    const payload = {
      customerId,
      amount: amt,
      notes: (notes?.value || "").trim(),
      createdAtUtc: createdAtUtcIso,
      bankType: bank,
      referenceNo: (referenceNo?.value || "").trim(),
      gameTypeId
    };

    btnSubmitTx.disabled = true;
    try {
      const endpoint =
        kind === "withdrawal" ? "/api/transactions/withdrawal"
        : kind === "bonus" ? "/api/transactions/bonus"
        : "/api/transactions/deposit";

      await apiFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });

      setMsg(txMsg, `${kind.toUpperCase()} submitted.`, true);

      amount.value = "";
      notes.value = "";
      referenceNo.value = "";
      setPngNowToInput();

      txPage = 1;
      await loadAllTransactions();
    } catch (e) {
      setMsg(txMsg, String(e?.message || e), false);
    } finally {
      btnSubmitTx.disabled = false;
    }
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

  // ✅ NEW: paged ALL transactions
  async function loadAllTransactions() {
    const filter = (txFilter?.value || "all").toLowerCase();
    const q = (txSearch?.value || "").trim();

    const qs = new URLSearchParams();
    qs.set("page", String(txPage));
    qs.set("pageSize", String(txPageSize));
    if (q) qs.set("q", q);
    if (filter === "pending") qs.set("status", "pending");

    const res = await apiFetch(`/api/transactions/all?${qs.toString()}`);

    const items = Array.isArray(res?.items) ? res.items : [];
    const total = Number(res?.total || 0);
    txMaxPage = Math.max(1, Math.ceil(total / txPageSize));

    if (txCount) txCount.textContent = `${total} record(s)`;
    if (txPageInfo) txPageInfo.textContent = `Page ${txPage} / ${txMaxPage}`;
    if (txPrev) txPrev.disabled = txPage <= 1;
    if (txNext) txNext.disabled = txPage >= txMaxPage;

    txTbody.innerHTML = items.map(r => {
      const id = r.id;
      const status = String(r.statusName || "");
      const isPending = status.toLowerCase() === "pending";

      const approveReject = (isPending && canApproveReject)
        ? `
          <button class="btn" data-act="approve" data-id="${id}" type="button">Approve</button>
          <button class="btn ghost" data-act="reject" data-id="${id}" type="button">Reject</button>
        `
        : `<span class="mutedSmall">-</span>`;

      const editBtn = canEdit
        ? `<button class="btn ghost" data-act="edit" data-id="${id}" type="button">Edit</button>`
        : "";

      const rowJson = escapeHtml(JSON.stringify(r));

      return `
        <tr data-row="${rowJson}">
          <td>${escapeHtml(String(r.id ?? ""))}</td>
          <td>${escapeHtml(r.customerName || "")}</td>
          <td>${escapeHtml(r.typeName || "")}</td>
          <td>${escapeHtml(r.gameTypeName || "-")}</td>
          <td class="right">${escapeHtml(fmt2(r.amount))}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(r.bankType || "")}</td>
          <td>${escapeHtml(fmtDate(r.createdAt))}</td>
          <td style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
            ${editBtn}
            ${approveReject}
          </td>
        </tr>
      `;
    }).join("");
  }

  // Row actions
  txTbody?.addEventListener("click", async (e) => {
    const btn = e.target?.closest("button");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = Number(btn.getAttribute("data-id") || 0);
    if (!id) return;

    const tr = btn.closest("tr");
    const rowAttr = tr?.getAttribute("data-row") || "{}";
    let row = null;
    try { row = JSON.parse(rowAttr); } catch { row = null; }

    try {
      btn.disabled = true;

      if (act === "approve") {
        if (!canApproveReject) return;
        await approveTx(id);
        await loadAllTransactions();
      } else if (act === "reject") {
        if (!canApproveReject) return;
        await rejectTx(id);
        await loadAllTransactions();
      } else if (act === "edit") {
        if (!canEdit) return;
        if (!row) return alert("Row data missing.");
        openEditModal(row);
      }
    } catch (err) {
      alert(String(err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  // init
  setPngNowToInput();
  createdAtUtc?.addEventListener("focus", setPngNowToInput);
  setInterval(setPngNowToInput, 30000);

  btnCreateCustomer?.addEventListener("click", createCustomer);
  btnSubmitTx?.addEventListener("click", submitTx);

  // ✅ Refresh / filter / search / paging
  btnRefreshTx?.addEventListener("click", async () => { txPage = 1; await loadAllTransactions(); });
  txFilter?.addEventListener("change", async () => { txPage = 1; await loadAllTransactions(); });

  let t = null;
  txSearch?.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(async () => {
      txPage = 1;
      await loadAllTransactions();
    }, 350);
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

  await loadCustomers();
  await loadGameTypes();
  await loadAllTransactions();

  // realtime
  await startRealtime();
  onDashboardUpdated(() => loadAllTransactions());
});

(() => {
  "use strict";

  // =========================
  // CONFIG
  // =========================
  const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbygqrKBC1tXXuHCKHL0klEyxawsoONLYISoGX5ZALML2KW8rzu5AMbkhFPgpssGV0J-8w/exec";
  const SPIN_SYNC_URL = "/api/walletprovider/sync";

  // =========================
  // ELEMENTS
  // =========================
  const els = {
    form: document.getElementById("customerForm"),
    editId: document.getElementById("editId"),

    name: document.getElementById("name"),
    phone: document.getElementById("phone"),
    website: document.getElementById("website"),
    group: document.getElementById("group"),

    walletId: document.getElementById("walletId"),
    playerId: document.getElementById("playerId"),
    portalUsername: document.getElementById("portalUsername"),
    status: document.getElementById("status"),

    cashBalance: document.getElementById("cashBalance"),
    tokenBalance: document.getElementById("tokenBalance"),
    depositAmount: document.getElementById("depositAmount"),
    conversionRule: document.getElementById("conversionRule"),

    calculatedTokens: document.getElementById("calculatedTokens"),
    lastSync: document.getElementById("lastSync"),
    apiReference: document.getElementById("apiReference"),
    remarks: document.getElementById("remarks"),

    btnSave: document.getElementById("btnSave"),
    btnTopup: document.getElementById("btnTopup"),
    btnConvert: document.getElementById("btnConvert"),
    btnSyncPlayer: document.getElementById("btnSyncPlayer"),
    btnCancelEdit: document.getElementById("btnCancelEdit"),
    btnRefresh: document.getElementById("btnRefresh"),
    btnSyncAll: document.getElementById("btnSyncAll"),

    search: document.getElementById("search"),
    tbody: document.getElementById("tbody"),
    countLabel: document.getElementById("countLabel"),
    statusMsg: document.getElementById("statusMsg")
  };

  // =========================
  // STATE
  // =========================
  let records = [];

  // =========================
  // INIT
  // =========================
  initApp();

  async function initApp() {
    bindEvents();
    updateCalculatedTokens();
    await loadRecordsFromSheet();
  }

  // =========================
  // EVENT BINDING
  // =========================
  function bindEvents() {
    els.form.addEventListener("submit", handleSaveWallet);
    els.depositAmount.addEventListener("input", updateCalculatedTokens);
    els.conversionRule.addEventListener("change", updateCalculatedTokens);

    els.btnTopup.addEventListener("click", handleTopUp);
    els.btnConvert.addEventListener("click", handleConvertDeposit);
    els.btnSyncPlayer.addEventListener("click", handleSyncCurrentPlayer);
    els.btnCancelEdit.addEventListener("click", resetForm);
    els.btnRefresh.addEventListener("click", handleRefresh);
    els.btnSyncAll.addEventListener("click", handleSyncAll);

    els.search.addEventListener("input", renderTable);
    els.tbody.addEventListener("click", handleTableAction);
  }

  // =========================
  // HELPERS
  // =========================
  function generateId() {
    return "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function generateWalletId() {
    return "WALLET-" + Date.now().toString().slice(-6);
  }

  function generatePlayerId() {
    return "SPIN-" + Date.now().toString().slice(-6);
  }

  function nowString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message, isError = false) {
    if (!els.statusMsg) return;
    els.statusMsg.textContent = message;
    els.statusMsg.style.color = isError ? "#c93c3c" : "#2f9e44";
  }

  function clearStatus() {
    setStatus("");
  }

  function toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(value) {
    return toNumber(value).toFixed(2);
  }

  function formatInt(value) {
    return Math.floor(toNumber(value));
  }

  function parseConversionRule(rule) {
    const cleanRule = String(rule || "").replace(/\s+/g, "");
    const match = cleanRule.match(/^(\d+(?:\.\d+)?)=(\d+(?:\.\d+)?)/);

    if (!match) {
      return { amountPerSpin: 100, spinCount: 1 };
    }

    const amountPerSpin = parseFloat(match[1]);
    const spinCount = parseFloat(match[2]);

    if (!Number.isFinite(amountPerSpin) || amountPerSpin <= 0) {
      return { amountPerSpin: 100, spinCount: 1 };
    }

    return {
      amountPerSpin,
      spinCount: Number.isFinite(spinCount) && spinCount > 0 ? spinCount : 1
    };
  }

  function calculateTokens(depositAmount, conversionRule) {
    const deposit = toNumber(depositAmount);
    const { amountPerSpin, spinCount } = parseConversionRule(conversionRule);

    if (deposit <= 0) return 0;

    const fullSets = Math.floor(deposit / amountPerSpin);
    return fullSets * spinCount;
  }

  function normalizeSheetRecord(r) {
    return {
      id: String(r.id || ""),
      name: String(r.name || ""),
      phone: String(r.phone || ""),
      website: String(r.website || ""),
      group: String(r.group_name || ""),
      walletId: String(r.wallet_id || ""),
      playerId: String(r.player_id || ""),
      portalUsername: String(r.portal_username || ""),
      status: String(r.status || "active"),
      cashBalance: toNumber(r.cash_balance),
      tokenBalance: formatInt(r.spin_token_balance),
      depositAmount: toNumber(r.deposit_amount),
      conversionRule: String(r.conversion_rule || "100=1"),
      calculatedTokens: formatInt(r.calculated_tokens),
      lastSync: String(r.last_sync || ""),
      apiReference: String(r.api_reference || ""),
      remarks: String(r.remarks || ""),
      createdAt: String(r.created_at || ""),
      updatedAt: String(r.updated_at || "")
    };
  }

  function getFormData() {
    return {
      id: els.editId.value.trim() || generateId(),
      name: els.name.value.trim(),
      phone: els.phone.value.trim(),
      website: els.website.value.trim(),
      group: els.group.value.trim(),

      walletId: els.walletId.value.trim() || generateWalletId(),
      playerId: els.playerId.value.trim() || generatePlayerId(),
      portalUsername: els.portalUsername.value.trim(),
      status: els.status.value,

      cashBalance: toNumber(els.cashBalance.value),
      tokenBalance: formatInt(els.tokenBalance.value),
      depositAmount: toNumber(els.depositAmount.value),
      conversionRule: els.conversionRule.value,

      calculatedTokens: formatInt(els.calculatedTokens.value),
      lastSync: els.lastSync.value.trim(),
      apiReference: els.apiReference.value.trim(),
      remarks: els.remarks.value.trim(),

      createdAt: "",
      updatedAt: nowString()
    };
  }

  function validateRecord(record) {
    if (!record.name) return "Customer name is required.";
    if (!record.phone) return "Phone number is required.";
    if (!record.walletId) return "Wallet ID is required.";
    return "";
  }

  function findRecordIndexById(id) {
    return records.findIndex((r) => r.id === id);
  }

  function updateCalculatedTokens() {
    const depositAmount = toNumber(els.depositAmount.value);
    const conversionRule = els.conversionRule.value;
    const tokens = calculateTokens(depositAmount, conversionRule);
    els.calculatedTokens.value = tokens;
  }

  function mapRecordToSheetPayload(record) {
    return {
      id: record.id,
      name: record.name,
      phone: record.phone,
      website: record.website,
      group_name: record.group,
      wallet_id: record.walletId,
      player_id: record.playerId,
      portal_username: record.portalUsername,
      status: record.status,
      cash_balance: toNumber(record.cashBalance),
      spin_token_balance: formatInt(record.tokenBalance),
      deposit_amount: toNumber(record.depositAmount),
      conversion_rule: record.conversionRule,
      calculated_tokens: formatInt(record.calculatedTokens),
      last_sync: record.lastSync || "",
      api_reference: record.apiReference || "",
      remarks: record.remarks || "",
      created_at: record.createdAt || "",
      updated_at: record.updatedAt || nowString()
    };
  }

  // =========================
  // GOOGLE SHEET API
  // =========================
  async function fetchSheetRecords() {
    const response = await fetch(`${SHEET_API_URL}?action=list`, {
      method: "GET"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load records from Google Sheet.");
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  async function saveSheetRecord(record) {
    const response = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "save",
        payload: mapRecordToSheetPayload(record)
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to save record to Google Sheet.");
    }

    return result.data || null;
  }

  async function deleteSheetRecord(id) {
    const response = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "delete",
        id
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to delete record from Google Sheet.");
    }

    return true;
  }

  // =========================
  // ASP.NET CORE SYNC
  // =========================
  async function syncToSpinPortal(record) {
    const response = await fetch(SPIN_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        walletId: record.walletId,
        playerId: record.playerId,
        name: record.name,
        phone: record.phone,
        website: record.website,
        groupName: record.group,
        portalUsername: record.portalUsername,
        status: record.status,
        cashBalance: toNumber(record.cashBalance),
        spinTokenBalance: formatInt(record.tokenBalance),
        depositAmount: toNumber(record.depositAmount),
        conversionRule: record.conversionRule,
        convertedTokens: calculateTokens(record.depositAmount, record.conversionRule),
        lastSync: record.lastSync || "",
        apiReference: record.apiReference || "",
        remarks: record.remarks || ""
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Spin portal sync failed.");
    }

    return result;
  }

  // =========================
  // LOAD / REFRESH
  // =========================
  async function loadRecordsFromSheet() {
    try {
      setStatus("Loading records from Google Sheet...");
      const sheetRecords = await fetchSheetRecords();
      records = sheetRecords.map(normalizeSheetRecord);
      renderTable();
      setStatus("Records loaded successfully.");
    } catch (error) {
      console.error(error);
      records = [];
      renderTable();
      setStatus(error.message || "Failed to load records.", true);
    }
  }

  async function handleRefresh() {
    clearStatus();
    await loadRecordsFromSheet();
  }

  // =========================
  // MAIN ACTIONS
  // =========================
  async function handleSaveWallet(event) {
    event.preventDefault();
    clearStatus();

    const record = getFormData();
    record.calculatedTokens = calculateTokens(record.depositAmount, record.conversionRule);

    const error = validateRecord(record);
    if (error) {
      setStatus(error, true);
      return;
    }

    try {
      const existingIndex = findRecordIndexById(record.id);
      if (existingIndex > -1) {
        record.createdAt = records[existingIndex].createdAt || "";
      } else {
        record.createdAt = nowString();
      }

      await saveSheetRecord(record);
      await loadRecordsFromSheet();
      resetForm();
      setStatus(existingIndex > -1 ? "Wallet updated in Google Sheet." : "Wallet saved to Google Sheet.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to save wallet.", true);
    }
  }

  async function handleTopUp() {
    clearStatus();

    let record = getFormData();
    const error = validateRecord(record);
    if (error) {
      setStatus(error, true);
      return;
    }

    const depositAmount = toNumber(record.depositAmount);
    if (depositAmount <= 0) {
      setStatus("Enter a deposit amount greater than 0.", true);
      return;
    }

    const existingIndex = findRecordIndexById(record.id);
    const existingRecord = existingIndex > -1 ? records[existingIndex] : null;

    record.createdAt = existingRecord?.createdAt || nowString();
    record.cashBalance = toNumber(record.cashBalance) + depositAmount;
    record.calculatedTokens = calculateTokens(record.depositAmount, record.conversionRule);
    record.updatedAt = nowString();

    updateFormFromRecord(record);

    try {
      await saveSheetRecord(record);
      await loadRecordsFromSheet();
      populateFormForEdit(record);
      setStatus(`Top up successful. Cash balance is now ${formatMoney(record.cashBalance)}.`);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to top up wallet.", true);
    }
  }

  async function handleConvertDeposit() {
    clearStatus();

    let record = getFormData();
    const error = validateRecord(record);
    if (error) {
      setStatus(error, true);
      return;
    }

    const depositAmount = toNumber(record.depositAmount);
    if (depositAmount <= 0) {
      setStatus("Enter a deposit amount greater than 0 before converting.", true);
      return;
    }

    const tokensToAdd = calculateTokens(depositAmount, record.conversionRule);
    if (tokensToAdd <= 0) {
      setStatus("Deposit amount does not qualify for spin token conversion.", true);
      return;
    }

    const existingIndex = findRecordIndexById(record.id);
    const existingRecord = existingIndex > -1 ? records[existingIndex] : null;

    record.createdAt = existingRecord?.createdAt || nowString();
    record.calculatedTokens = tokensToAdd;
    record.tokenBalance = formatInt(record.tokenBalance) + tokensToAdd;
    record.updatedAt = nowString();

    updateFormFromRecord(record);

    try {
      await saveSheetRecord(record);
      await loadRecordsFromSheet();
      populateFormForEdit(record);
      setStatus(`${tokensToAdd} spin token(s) added successfully.`);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to convert deposit.", true);
    }
  }

  async function handleSyncCurrentPlayer() {
    clearStatus();

    let record = getFormData();
    const error = validateRecord(record);
    if (error) {
      setStatus(error, true);
      return;
    }

    const existingIndex = findRecordIndexById(record.id);
    const existingRecord = existingIndex > -1 ? records[existingIndex] : null;
    record.createdAt = existingRecord?.createdAt || nowString();

    try {
      await syncToSpinPortal(record);

      const syncTime = nowString();
      record.lastSync = syncTime;
      record.updatedAt = syncTime;
      els.lastSync.value = syncTime;

      await saveSheetRecord(record);
      await loadRecordsFromSheet();
      populateFormForEdit(record);

      setStatus("Player synced to spin portal successfully.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to sync player to spin portal.", true);
    }
  }

  async function handleSyncAll() {
    clearStatus();

    if (!records.length) {
      setStatus("No wallet records to sync.", true);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const current of records) {
      try {
        const record = { ...current };
        await syncToSpinPortal(record);
        record.lastSync = nowString();
        record.updatedAt = nowString();
        await saveSheetRecord(record);
        successCount++;
      } catch (error) {
        console.error("Sync failed for record:", current.walletId, error);
        failCount++;
      }
    }

    await loadRecordsFromSheet();

    if (failCount === 0) {
      setStatus(`All ${successCount} wallet record(s) synced successfully.`);
    } else {
      setStatus(`Sync completed. Success: ${successCount}, Failed: ${failCount}.`, true);
    }
  }

  // =========================
  // TABLE ACTIONS
  // =========================
  function handleTableAction(event) {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.getAttribute("data-action");
    const id = actionBtn.getAttribute("data-id");
    const record = records.find((r) => r.id === id);

    if (!record) {
      setStatus("Record not found.", true);
      return;
    }

    if (action === "edit") {
      populateFormForEdit(record);
      return;
    }

    if (action === "delete") {
      handleDeleteRecord(record);
      return;
    }

    if (action === "sync") {
      handleQuickSync(record);
      return;
    }

    if (action === "topup") {
      populateFormForEdit(record);
      setStatus("Record loaded. Enter deposit amount, then click Top Up.");
    }
  }

  function populateFormForEdit(record) {
    els.editId.value = record.id || "";
    els.name.value = record.name || "";
    els.phone.value = record.phone || "";
    els.website.value = record.website || "";
    els.group.value = record.group || "";

    els.walletId.value = record.walletId || "";
    els.playerId.value = record.playerId || "";
    els.portalUsername.value = record.portalUsername || "";
    els.status.value = record.status || "active";

    els.cashBalance.value = toNumber(record.cashBalance);
    els.tokenBalance.value = formatInt(record.tokenBalance);
    els.depositAmount.value = toNumber(record.depositAmount);
    els.conversionRule.value = record.conversionRule || "100=1";

    els.calculatedTokens.value = formatInt(record.calculatedTokens);
    els.lastSync.value = record.lastSync || "";
    els.apiReference.value = record.apiReference || "";
    els.remarks.value = record.remarks || "";

    els.btnCancelEdit.hidden = false;
    updateCalculatedTokens();
    setStatus(`Editing wallet ${record.walletId}.`);
  }

  function updateFormFromRecord(record) {
    els.editId.value = record.id || "";
    els.walletId.value = record.walletId || "";
    els.playerId.value = record.playerId || "";
    els.cashBalance.value = toNumber(record.cashBalance);
    els.tokenBalance.value = formatInt(record.tokenBalance);
    els.depositAmount.value = toNumber(record.depositAmount);
    els.calculatedTokens.value = formatInt(record.calculatedTokens);
    els.lastSync.value = record.lastSync || "";
  }

  async function handleDeleteRecord(record) {
    const ok = window.confirm(`Delete wallet record for ${record.name} (${record.walletId})?`);
    if (!ok) return;

    try {
      await deleteSheetRecord(record.id);
      await loadRecordsFromSheet();

      if (els.editId.value === record.id) {
        resetForm();
      }

      setStatus("Wallet record deleted successfully.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to delete wallet.", true);
    }
  }

  async function handleQuickSync(record) {
    try {
      const updatedRecord = { ...record };
      await syncToSpinPortal(updatedRecord);

      updatedRecord.lastSync = nowString();
      updatedRecord.updatedAt = nowString();

      await saveSheetRecord(updatedRecord);
      await loadRecordsFromSheet();

      setStatus(`Wallet ${record.walletId} synced successfully.`);
    } catch (error) {
      console.error(error);
      setStatus(`Failed to sync wallet ${record.walletId}.`, true);
    }
  }

  // =========================
  // RENDER
  // =========================
  function renderTable() {
    const query = els.search.value.trim().toLowerCase();

    const filtered = records.filter((record) => {
      const haystack = [
        record.name,
        record.phone,
        record.website,
        record.group,
        record.walletId,
        record.playerId,
        record.portalUsername,
        record.status
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    els.tbody.innerHTML = "";

    if (!filtered.length) {
      els.tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:18px;">
            No wallet records found.
          </td>
        </tr>
      `;
      els.countLabel.textContent = "0 wallet record(s)";
      return;
    }

    const rowsHtml = filtered
      .map((record) => {
        return `
          <tr>
            <td>
              <div style="font-weight:600;">${escapeHtml(record.name)}</div>
              <div class="mutedSmall">${escapeHtml(record.group || "-")}</div>
            </td>
            <td>${escapeHtml(record.phone || "-")}</td>
            <td>${escapeHtml(record.walletId || "-")}</td>
            <td>${escapeHtml(record.playerId || "-")}</td>
            <td>${formatMoney(record.cashBalance)}</td>
            <td>${formatInt(record.tokenBalance)}</td>
            <td>${escapeHtml(record.status || "-")}</td>
            <td>${escapeHtml(record.lastSync || "Not synced")}</td>
            <td class="center">
              <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                <button class="btn ghost" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Edit</button>
                <button class="btn ghost" type="button" data-action="topup" data-id="${escapeHtml(record.id)}">Top Up</button>
                <button class="btn ghost" type="button" data-action="sync" data-id="${escapeHtml(record.id)}">Sync</button>
                <button class="btn ghost" type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    els.tbody.innerHTML = rowsHtml;
    els.countLabel.textContent = `${filtered.length} wallet record(s)`;
  }

  // =========================
  // FORM RESET
  // =========================
  function resetForm() {
    els.form.reset();

    els.editId.value = "";
    els.cashBalance.value = 0;
    els.tokenBalance.value = 0;
    els.depositAmount.value = 0;
    els.calculatedTokens.value = 0;
    els.lastSync.value = "";
    els.btnCancelEdit.hidden = true;

    clearStatus();
  }
})();
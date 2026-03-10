const STORAGE_KEY = "millionairesgroup_customers";

const state = {
  customers: [],
  filteredCustomers: [],
  loading: false
};

const els = {
  form: document.getElementById("customerForm"),
  editId: document.getElementById("editId"),

  customerCode: document.getElementById("customerCode"),
  fullName: document.getElementById("fullName"),
  username: document.getElementById("username"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  website: document.getElementById("website"),
  groupName: document.getElementById("groupName"),
  status: document.getElementById("status"),

  currency: document.getElementById("currency"),
  mainBalance: document.getElementById("mainBalance"),
  bonusBalance: document.getElementById("bonusBalance"),
  lockedBalance: document.getElementById("lockedBalance"),

  actionAmount: document.getElementById("actionAmount"),
  actionRemarks: document.getElementById("actionRemarks"),

  search: document.getElementById("search"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnSave: document.getElementById("btnSave"),
  btnCredit: document.getElementById("btnCredit"),
  btnDebit: document.getElementById("btnDebit"),
  btnCancelEdit: document.getElementById("btnCancelEdit"),

  tbody: document.getElementById("tbody"),
  countLabel: document.getElementById("countLabel"),
  statusMsg: document.getElementById("statusMsg")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  loadCustomers();
}

function bindEvents() {
  els.form.addEventListener("submit", onSubmitCustomerForm);
  els.search.addEventListener("input", applySearchFilter);
  els.btnRefresh.addEventListener("click", loadCustomers);
  els.btnCancelEdit.addEventListener("click", resetForm);
  els.btnCredit.addEventListener("click", onCreditWallet);
  els.btnDebit.addEventListener("click", onDebitWallet);

  els.tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);

    if (action === "edit") editCustomer(id);
    if (action === "delete") deleteCustomer(id);
    if (action === "transactions") viewTransactions(id);
  });
}

function loadCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.customers = raw ? JSON.parse(raw) : [];
    applySearchFilter();
    setStatus(`Loaded ${state.customers.length} customer(s).`, "success");
  } catch (error) {
    console.error(error);
    state.customers = [];
    state.filteredCustomers = [];
    renderTable();
    setStatus("Failed to load saved data.", "error");
  }
}

function saveCustomers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customers));
}

function applySearchFilter() {
  const keyword = (els.search.value || "").trim().toLowerCase();

  if (!keyword) {
    state.filteredCustomers = [...state.customers];
  } else {
    state.filteredCustomers = state.customers.filter((item) => {
      const wallet = item.wallet || {};
      const haystack = [
        item.customer_code,
        item.full_name,
        item.username,
        item.phone,
        item.email,
        item.website,
        item.group_name,
        item.status,
        item.currency,
        wallet.main_balance,
        wallet.bonus_balance,
        wallet.locked_balance
      ].join(" ").toLowerCase();

      return haystack.includes(keyword);
    });
  }

  renderTable();
}

function renderTable() {
  if (!state.filteredCustomers.length) {
    els.tbody.innerHTML = `
      <tr>
        <td colspan="11" class="center">No records found.</td>
      </tr>
    `;
    updateCountLabel();
    return;
  }

  els.tbody.innerHTML = state.filteredCustomers.map(renderRow).join("");
  updateCountLabel();
}

function renderRow(item) {
  const wallet = item.wallet || {};

  return `
    <tr>
      <td>${escapeHtml(item.customer_code || "")}</td>
      <td>${escapeHtml(item.full_name || "")}</td>
      <td>${escapeHtml(item.username || "")}</td>
      <td>${escapeHtml(item.phone || "")}</td>
      <td>${escapeHtml(item.website || "")}</td>
      <td>${escapeHtml(item.group_name || "")}</td>
      <td>${renderStatus(item.status || "inactive")}</td>
      <td>${formatMoney(wallet.main_balance)}</td>
      <td>${formatMoney(wallet.bonus_balance)}</td>
      <td>${formatMoney(wallet.locked_balance)}</td>
      <td class="center">
        <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
          <button class="btn ghost" type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="btn warning" type="button" data-action="transactions" data-id="${item.id}">History</button>
          <button class="btn danger" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderStatus(status) {
  const value = String(status || "").toLowerCase();
  return `<span class="pill ${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

function updateCountLabel() {
  els.countLabel.textContent = `${state.filteredCustomers.length} record(s)`;
}

function onSubmitCustomerForm(event) {
  event.preventDefault();

  try {
    const payload = getCustomerPayload();
    validatePayload(payload);

    const editId = Number(els.editId.value || 0);

    if (editId) {
      const index = state.customers.findIndex(item => Number(item.id) === editId);
      if (index === -1) throw new Error("Customer not found.");

      state.customers[index] = {
        ...state.customers[index],
        ...payload,
        id: editId,
        transactions: state.customers[index].transactions || []
      };

      setStatus("Customer updated successfully.", "success");
    } else {
      const item = {
        id: Date.now(),
        ...payload,
        transactions: []
      };
      state.customers.unshift(item);
      setStatus("Customer created successfully.", "success");
    }

    saveCustomers();
    resetForm();
    applySearchFilter();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to save customer.", "error");
  }
}

function getCustomerPayload() {
  return {
    customer_code: els.customerCode.value.trim(),
    full_name: els.fullName.value.trim(),
    username: els.username.value.trim(),
    phone: els.phone.value.trim(),
    email: els.email.value.trim(),
    website: els.website.value.trim(),
    group_name: els.groupName.value.trim(),
    status: els.status.value,
    currency: els.currency.value,
    wallet: {
      main_balance: parseNumber(els.mainBalance.value),
      bonus_balance: parseNumber(els.bonusBalance.value),
      locked_balance: parseNumber(els.lockedBalance.value)
    }
  };
}

function validatePayload(payload) {
  if (!payload.full_name) throw new Error("Full Name is required.");
  if (!payload.username) throw new Error("Username is required.");
  if (!payload.phone) throw new Error("Phone Number is required.");
}

function editCustomer(id) {
  const customer = state.customers.find(item => Number(item.id) === Number(id));
  if (!customer) return;

  const wallet = customer.wallet || {};

  els.editId.value = customer.id || "";
  els.customerCode.value = customer.customer_code || "";
  els.fullName.value = customer.full_name || "";
  els.username.value = customer.username || "";
  els.phone.value = customer.phone || "";
  els.email.value = customer.email || "";
  els.website.value = customer.website || "";
  els.groupName.value = customer.group_name || "";
  els.status.value = customer.status || "active";
  els.currency.value = customer.currency || "USD";

  els.mainBalance.value = Number(wallet.main_balance || 0).toFixed(2);
  els.bonusBalance.value = Number(wallet.bonus_balance || 0).toFixed(2);
  els.lockedBalance.value = Number(wallet.locked_balance || 0).toFixed(2);

  els.actionAmount.value = "";
  els.actionRemarks.value = "";

  els.btnSave.textContent = "Update Customer";
  els.btnCancelEdit.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
  setStatus(`Editing ${customer.full_name}.`, "success");
}

function resetForm() {
  els.form.reset();
  els.editId.value = "";
  els.status.value = "active";
  els.currency.value = "USD";
  els.mainBalance.value = "0.00";
  els.bonusBalance.value = "0.00";
  els.lockedBalance.value = "0.00";
  els.actionAmount.value = "";
  els.actionRemarks.value = "";
  els.btnSave.textContent = "Save Customer";
  els.btnCancelEdit.hidden = true;
}

function deleteCustomer(id) {
  const customer = state.customers.find(item => Number(item.id) === Number(id));
  if (!customer) return;

  const confirmed = window.confirm(`Delete ${customer.full_name}?`);
  if (!confirmed) return;

  state.customers = state.customers.filter(item => Number(item.id) !== Number(id));
  saveCustomers();
  applySearchFilter();

  if (Number(els.editId.value || 0) === Number(id)) {
    resetForm();
  }

  setStatus("Customer deleted successfully.", "success");
}

function onCreditWallet() {
  try {
    const id = Number(els.editId.value || 0);
    if (!id) throw new Error("Select a customer first using Edit.");

    const amount = parseNumber(els.actionAmount.value);
    if (amount <= 0) throw new Error("Enter a valid credit amount.");

    const remarks = els.actionRemarks.value.trim();
    const customer = state.customers.find(item => Number(item.id) === id);
    if (!customer) throw new Error("Customer not found.");

    customer.wallet.main_balance = parseNumber(customer.wallet.main_balance) + amount;

    customer.transactions = customer.transactions || [];
    customer.transactions.unshift({
      id: Date.now(),
      type: "credit",
      amount,
      remarks,
      created_at: new Date().toLocaleString()
    });

    saveCustomers();
    editCustomer(id);
    applySearchFilter();
    setStatus("Wallet credited successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to credit wallet.", "error");
  }
}

function onDebitWallet() {
  try {
    const id = Number(els.editId.value || 0);
    if (!id) throw new Error("Select a customer first using Edit.");

    const amount = parseNumber(els.actionAmount.value);
    if (amount <= 0) throw new Error("Enter a valid debit amount.");

    const remarks = els.actionRemarks.value.trim();
    const customer = state.customers.find(item => Number(item.id) === id);
    if (!customer) throw new Error("Customer not found.");

    const current = parseNumber(customer.wallet.main_balance);
    if (amount > current) throw new Error("Insufficient main balance.");

    customer.wallet.main_balance = current - amount;

    customer.transactions = customer.transactions || [];
    customer.transactions.unshift({
      id: Date.now(),
      type: "debit",
      amount,
      remarks,
      created_at: new Date().toLocaleString()
    });

    saveCustomers();
    editCustomer(id);
    applySearchFilter();
    setStatus("Wallet debited successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to debit wallet.", "error");
  }
}

function viewTransactions(id) {
  const customer = state.customers.find(item => Number(item.id) === Number(id));
  if (!customer) return;

  const transactions = customer.transactions || [];
  if (!transactions.length) {
    alert(`No transaction history for ${customer.full_name}.`);
    return;
  }

  const preview = transactions
    .slice(0, 15)
    .map((tx, i) => {
      return `${i + 1}. ${tx.type.toUpperCase()} | ${formatMoney(tx.amount)} | ${tx.remarks || "-"} | ${tx.created_at}`;
    })
    .join("\n");

  alert(`Transaction History - ${customer.full_name}\n\n${preview}`);
}

function setStatus(message, type = "info") {
  els.statusMsg.textContent = message || "";

  const map = {
    info: "#475569",
    success: "#15803d",
    error: "#dc2626"
  };

  els.statusMsg.style.color = map[type] || map.info;
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
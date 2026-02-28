(() => {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyIzzPRkeIatOYbvM74YR0HQfsZA8mIY1Eg1sgxuig5480Jj69ex-ujqgoQhnIne_ZG-Q/exec";     // ✅ put your Apps Script WebApp URL here
  const SECRET_KEY = "skgroup-2424@";     
  const $ = (id) => document.getElementById(id);

  const form = $("customerForm");
  const tbody = $("tbody");
  const search = $("search");
  const btnRefresh = $("btnRefresh");
  const statusMsg = $("statusMsg");
  const countLabel = $("countLabel");
  const btnCancelEdit = $("btnCancelEdit");
  const btnSave = $("btnSave");

  let cache = [];
  let isSaving = false;

  function toast(msg, ok = true) {
    statusMsg.textContent = msg || "";
    statusMsg.style.color = ok ? "" : "#ff2b2b";
    if (msg) setTimeout(() => statusMsg.textContent = "", 2000);
  }

  function setSaving(state) {
    isSaving = state;
    btnSave.disabled = state;
    btnSave.style.opacity = state ? "0.6" : "";
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function maskPhone(phone) {
    phone = String(phone || "");
    if (phone.length <= 7) return "X".repeat(phone.length);
    return "X".repeat(7) + phone.slice(7);
  }

  async function sheetGetAll() {
    const res = await fetch(`${WEBAPP_URL}?key=${SECRET_KEY}`);
    const out = await res.json();
    if (!out.ok) throw new Error(out.error);
    return out.rows || [];
  }

  async function sheetAdd(data) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("name", data.name);
    fd.append("phoneNumber", data.phoneNumber);
    fd.append("website", data.website);
    fd.append("group", data.group);

    const res = await fetch(WEBAPP_URL, { method:"POST", body:fd });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error);
  }

  async function sheetUpdate(rowId, data) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("action", "update");
    fd.append("rowId", rowId);
    fd.append("name", data.name);
    fd.append("phoneNumber", data.phoneNumber);
    fd.append("website", data.website);
    fd.append("group", data.group);

    const res = await fetch(WEBAPP_URL, { method:"POST", body:fd });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error);
  }

  async function sheetDelete(rowId) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("action", "delete");
    fd.append("rowId", rowId);

    const res = await fetch(WEBAPP_URL, { method:"POST", body:fd });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error);
  }

  function render() {
    const q = search.value.toLowerCase();
    const list = cache.filter(r =>
      !q || JSON.stringify(r).toLowerCase().includes(q)
    );

    countLabel.textContent = `${list.length} record(s)`;

    tbody.innerHTML = list.map(r => `
      <tr>
        <td>${esc(r.Name)}</td>
        <td title="${esc(r.PhoneNumber)}">${maskPhone(r.PhoneNumber)}</td>
        <td>${esc(r.Website)}</td>
        <td>${esc(r.Group)}</td>
        <td class="center">
          <button class="btnMini" data-edit="${r._rowId}">Edit</button>
          <button class="btnMini danger" data-del="${r._rowId}">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  function startEdit(rowId) {
    const row = cache.find(r => String(r._rowId) === String(rowId));
    if (!row) return;

    $("editId").value = rowId;
    $("name").value = row.Name;
    $("phone").value = row.PhoneNumber;
    $("website").value = row.Website;
    $("group").value = row.Group;

    btnSave.textContent = "Update";
    btnCancelEdit.hidden = false;
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function resetForm() {
    form.reset();
    $("editId").value = "";
    btnSave.textContent = "Save";
    btnCancelEdit.hidden = true;
  }

  tbody.addEventListener("click", async e => {
    const edit = e.target.getAttribute("data-edit");
    const del = e.target.getAttribute("data-del");

    if (edit) return startEdit(edit);

    if (del) {
      if (!confirm("Delete this record?")) return;
      try {
        await sheetDelete(del);
        await reload();
        toast("Deleted");
      } catch(err) {
        toast(err.message,false);
      }
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (isSaving) return;

    const data = {
      name: $("name").value.trim(),
      phoneNumber: $("phone").value.trim(),
      website: $("website").value.trim(),
      group: $("group").value.trim()
    };

    if (!data.name) return toast("Name required",false);
    if (!data.phoneNumber) return toast("Phone required",false);

    const editId = $("editId").value;

    try {
      setSaving(true);

      if (editId) {
        await sheetUpdate(editId, data);
        toast("Updated");
      } else {
        await sheetAdd(data);
        toast("Saved");
      }

      resetForm();
      await reload();

    } catch(err) {
      toast(err.message,false);
    } finally {
      setSaving(false);
    }
  });

  btnCancelEdit.addEventListener("click", resetForm);
  search.addEventListener("input", render);
  btnRefresh.addEventListener("click", reload);

  async function reload() {
    cache = await sheetGetAll();
    render();
  }

  reload();

})();
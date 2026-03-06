(() => {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxJRzps4epIU7QoVL3rNLDvxQ-WYYWm6CeOgDSgsSj07bm1EV_J6qcsPlJWrBDpIiittg/exec";
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
    if (msg) setTimeout(() => (statusMsg.textContent = ""), 2500);
  }

  function setSaving(state, label) {
    isSaving = state;
    btnSave.disabled = state;
    btnSave.style.opacity = state ? "0.6" : "";
    if (label) btnSave.textContent = label;
  }

  function makeRequestId() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function maskPhone(phone) {
    const s = String(phone || "").trim();
    if (!s) return "";
    if (s.length <= 7) return "X".repeat(s.length);
    return "X".repeat(7) + s.slice(7);
  }

  async function sheetGetAll() {
    const res = await fetch(`${WEBAPP_URL}?key=${encodeURIComponent(SECRET_KEY)}`);
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Unauthorized");

    const rows = out.rows || [];
    if (rows.length && rows[0]._rowId === undefined) {
      throw new Error("Backend missing _rowId. Redeploy Apps Script new version.");
    }
    return rows;
  }

  async function post(fd) {
    const res = await fetch(WEBAPP_URL, { method: "POST", body: fd });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Request failed");
    return out;
  }

  async function sheetAdd(data) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("requestId", makeRequestId()); // ✅ prevents double submit
    fd.append("name", data.name);
    fd.append("phoneNumber", data.phoneNumber);
    fd.append("website", data.website);
    fd.append("group", data.group);
    return post(fd);
  }

  async function sheetUpdate(rowId, data) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("requestId", makeRequestId()); // ✅ prevents double submit
    fd.append("action", "update");
    fd.append("rowId", String(rowId));
    fd.append("name", data.name);
    fd.append("phoneNumber", data.phoneNumber);
    fd.append("website", data.website);
    fd.append("group", data.group);
    return post(fd);
  }

  async function sheetDelete(rowId) {
    const fd = new FormData();
    fd.append("key", SECRET_KEY);
    fd.append("requestId", makeRequestId()); // ✅ prevents double submit
    fd.append("action", "delete");
    fd.append("rowId", String(rowId));
    return post(fd);
  }

  function render() {
    const q = (search.value || "").toLowerCase().trim();
    const list = cache.filter(r => {
      const hay = `${r.Name||""} ${r.PhoneNumber||""} ${r.Website||""} ${r.Group||""}`.toLowerCase();
      return !q || hay.includes(q);
    });

    countLabel.textContent = `${list.length} record(s)`;

    tbody.innerHTML = list.map(r => `
      <tr>
        <td>${esc(r.Name || "")}</td>
        <td title="${esc(r.PhoneNumber || "")}">${esc(maskPhone(r.PhoneNumber || ""))}</td>
        <td>${esc(r.Website || "")}</td>
        <td>${esc(r.Group || "")}</td>
        <td class="center">
          <button class="btnMini" type="button" data-edit="${esc(r._rowId)}">Edit</button>
          <button class="btnMini danger" type="button" data-del="${esc(r._rowId)}">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  function startEdit(rowId) {
    const row = cache.find(r => String(r._rowId) === String(rowId));
    if (!row) return toast("Row not found", false);

    $("editId").value = rowId;
    $("name").value = row.Name || "";
    $("phone").value = row.PhoneNumber || "";
    $("website").value = row.Website || "";
    $("group").value = row.Group || "";

    btnSave.textContent = "Update";
    btnCancelEdit.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset();
    $("editId").value = "";
    btnSave.textContent = "Save";
    btnCancelEdit.hidden = true;
  }

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const edit = btn.getAttribute("data-edit");
    const del = btn.getAttribute("data-del");

    if (edit) return startEdit(edit);

    if (del) {
      if (!confirm("Delete this record?")) return;
      try {
        setSaving(true, "Deleting...");
        await sheetDelete(del);
        await reload();
        toast("Deleted ✅");
      } catch (err) {
        toast(err.message || "Delete failed", false);
      } finally {
        setSaving(false, $("editId").value ? "Update" : "Save");
      }
    }
  });

  // Strong lock: only submit once
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const data = {
      name: $("name").value.trim(),
      phoneNumber: $("phone").value.trim(),
      website: $("website").value.trim(),
      group: $("group").value.trim(),
    };

    if (!data.name) return toast("Name required", false);
    if (!data.phoneNumber) return toast("Phone required", false);

    const editId = $("editId").value;

    try {
      setSaving(true, editId ? "Updating..." : "Saving...");

      if (editId) await sheetUpdate(editId, data);
      else await sheetAdd(data);

      resetForm();
      await reload();
      toast(editId ? "Updated ✅" : "Saved ✅");

    } catch (err) {
      toast(err.message || "Save failed", false);
    } finally {
      setSaving(false, $("editId").value ? "Update" : "Save");
    }
  });

  // prevent Enter spam
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  btnCancelEdit.addEventListener("click", resetForm);
  search.addEventListener("input", render);
  btnRefresh.addEventListener("click", reload);

  async function reload() {
    try {
      cache = await sheetGetAll();
      render();
    } catch (err) {
      console.error(err);
      toast(err.message || "Load failed", false);
    }
  }

  reload();
})();
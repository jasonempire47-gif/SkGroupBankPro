(() => {
  const API = "/api/customercontacts";
  const $ = (id) => document.getElementById(id);

  const form = $("customerForm");
  const editId = $("editId");
  const tbody = $("tbody");
  const search = $("search");
  const btnRefresh = $("btnRefresh");
  const btnCancelEdit = $("btnCancelEdit");

  const statusMsg = $("statusMsg");
  const countLabel = $("countLabel");

  let cache = [];

  function toast(msg, ok=true){
    statusMsg.textContent = msg || "";
    statusMsg.style.color = ok ? "" : "var(--redBright, #ff2b2b)";
    if (msg) setTimeout(() => { if (!editId.value) statusMsg.textContent=""; }, 2000);
  }

  function normalizeWebsite(v){
    v = (v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.includes(".")) return "https://" + v.replace(/^\/+/, "");
    return v;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  async function apiGet(){
    const res = await fetch(API, { headers: { "Accept":"application/json" }});
    if (!res.ok) throw new Error("GET failed");
    return await res.json();
  }

  async function apiPost(body){
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("POST failed");
    return await res.json();
  }

  async function apiPut(id, body){
    const res = await fetch(`${API}/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("PUT failed");
    return await res.json();
  }

  async function apiDelete(id){
    const res = await fetch(`${API}/${id}`, { method:"DELETE" });
    if (!res.ok) throw new Error("DELETE failed");
  }

  function clearForm(){
    editId.value = "";
    form.reset();
    btnCancelEdit.hidden = true;
  }

  function setEdit(r){
    editId.value = r.id;
    $("name").value = r.name || "";
    $("phone").value = r.phoneNumber || "";
    $("website").value = r.website || "";
    btnCancelEdit.hidden = false;
  }

  function render(){
    const q = (search.value || "").trim().toLowerCase();
    const list = cache.filter(r => {
      const hay = `${r.name||""} ${r.phoneNumber||""} ${r.website||""}`.toLowerCase();
      return !q || hay.includes(q);
    });

    countLabel.textContent = `${list.length} record(s)`;

    tbody.innerHTML = list.map(r => {
      const w = (r.website || "").trim();
      const websiteHtml = w
        ? (/^https?:\/\//i.test(w)
            ? `<a href="${esc(w)}" target="_blank" rel="noopener" class="gold">${esc(w)}</a>`
            : `<span>${esc(w)}</span>`
          )
        : `<span class="mutedSmall">—</span>`;

      return `
        <tr>
          <td>${esc(r.name)}</td>
          <td>${esc(r.phoneNumber)}</td>
          <td>${websiteHtml}</td>
          <td class="center">
            <button class="btn ghost" type="button" data-act="edit" data-id="${r.id}">Edit</button>
            <button class="btn ghost" type="button" data-act="del" data-id="${r.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function reload(){
    try{
      cache = await apiGet();
      render();
      toast("Loaded.");
    }catch(e){
      console.error(e);
      toast("Failed to load.", false);
    }
  }

  // actions
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    const rec = cache.find(x => String(x.id) === String(id));

    if (act === "edit" && rec) setEdit(rec);

    if (act === "del") {
      if (!confirm("Delete this record?")) return;
      try{
        await apiDelete(id);
        if (editId.value === String(id)) clearForm();
        await reload();
        toast("Deleted.");
      }catch(err){
        console.error(err);
        toast("Delete failed.", false);
      }
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      name: ($("name").value || "").trim(),
      phoneNumber: ($("phone").value || "").trim(),
      website: normalizeWebsite($("website").value)
    };

    if (!payload.name) return toast("Name required.", false);
    if (!payload.phoneNumber) return toast("Phone required.", false);

    try{
      if (editId.value) {
        await apiPut(editId.value, payload);
        toast("Updated.");
      } else {
        await apiPost(payload);
        toast("Saved.");
      }
      clearForm();
      await reload();
    }catch(err){
      console.error(err);
      toast("Save failed.", false);
    }
  });

  btnCancelEdit.addEventListener("click", () => {
    clearForm();
    toast("Edit cancelled.");
  });

  search.addEventListener("input", render);
  btnRefresh.addEventListener("click", reload);

  reload();
})();
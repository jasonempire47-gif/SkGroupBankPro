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

  let cache = [];

  function toast(msg, ok = true) {
    if (!statusMsg) return;
    statusMsg.textContent = msg || "";
    statusMsg.style.color = ok ? "" : "#ff2b2b";
    if (msg) setTimeout(() => (statusMsg.textContent = ""), 2200);
  }

  function normalizeWebsite(v) {
    v = (v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.includes(".")) return "https://" + v.replace(/^\/+/, "");
    return v;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function sheetGetAll() {
    const url = `${WEBAPP_URL}?key=${encodeURIComponent(SECRET_KEY)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("GET failed");
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Unauthorized");
    return out.rows || [];
  }

 async function sheetAdd(payload) {
  const fd = new FormData();
  fd.append("key", SECRET_KEY);
  fd.append("name", payload.name || "");
  fd.append("phoneNumber", payload.phoneNumber || "");
  fd.append("website", payload.website || "");
  fd.append("group", payload.group || "");

  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    body: fd, // ✅ no headers
  });

  if (!res.ok) throw new Error("POST failed");
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "Save failed");
  return out;
}

  function render() {
  const q = (search?.value || "").trim().toLowerCase();

  const list = cache.filter((r) => {
    const hay = `${r.Name || ""} ${r.PhoneNumber || ""} ${r.Website || ""} ${r.Group || ""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  if (countLabel) countLabel.textContent = `${list.length} record(s)`;
  if (!tbody) return;

  tbody.innerHTML = list.map((r) => {
    const website = String(r.Website ?? "").trim();
    const websiteHtml = website
      ? (/^https?:\/\//i.test(website)
          ? `<a class="gold" href="${esc(website)}" target="_blank" rel="noopener">${esc(website)}</a>`
          : `<span>${esc(website)}</span>`)
      : `<span class="mutedSmall">—</span>`;

    const groupHtml = (r.Group || "").trim()
      ? `<span>${esc(r.Group)}</span>`
      : `<span class="mutedSmall">—</span>`;

    return `
      <tr>
        <td>${esc(r.Name || "")}</td>
        <td>${esc(r.PhoneNumber || "")}</td>
        <td>${websiteHtml}</td>
        <td>${groupHtml}</td>
        <td class="center">
          <div class="rowActions">
            <button class="btnMini" data-edit="${esc(r._rowId || "")}">Edit</button>
            <button class="btnMini danger" data-del="${esc(r._rowId || "")}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

  async function reload() {
    try {
      cache = await sheetGetAll();
      render();
      toast("Loaded.");
    } catch (e) {
      console.error(e);
      toast("Failed to load (check key / deployment).", false);
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      name: ($("name").value || "").trim(),
      phoneNumber: ($("phone").value || "").trim(),
      website: normalizeWebsite($("website").value),
      group: ($("group").value || "").trim(), // ✅ ADD GROUP
    };

    if (!payload.name) return toast("Name required.", false);
    if (!payload.phoneNumber) return toast("Phone required.", false);

    try {
      await sheetAdd(payload);
      form.reset();
      await reload();
      toast("Saved to Google Sheet ✅");
    } catch (e) {
      console.error(e);
      toast(String(e.message || "Save failed"), false);
    }
  });

  search?.addEventListener("input", render);
  btnRefresh?.addEventListener("click", reload);

  reload();
})();
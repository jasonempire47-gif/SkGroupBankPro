(() => {
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxbxrYVq-Yfpp307pOzsc90XUm1INUE4JDw4_6Cw8m7u86H-LxhzVKpSU3bE0Umwj4/exec";
  const SECRET_KEY = "skgroup-0808"; // ✅ must match Apps Script SECRET

  const $ = (id) => document.getElementById(id);

  const form = $("customerForm");
  const tbody = $("tbody");
  const search = $("search");
  const btnRefresh = $("btnRefresh");
  const btnExportCsv = $("btnExportCsv");
  const statusMsg = $("statusMsg");
  const countLabel = $("countLabel");

  let cache = [];

  function toast(msg, ok = true) {
    statusMsg.textContent = msg || "";
    statusMsg.style.color = ok ? "" : "#ff2b2b";
    if (msg) setTimeout(() => (statusMsg.textContent = ""), 2200);
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeWebsite(v) {
    v = (v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.includes(".")) return "https://" + v.replace(/^\/+/, "");
    return v;
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
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, key: SECRET_KEY }),
    });
    if (!res.ok) throw new Error("POST failed");
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Save failed");
    return out;
  }

  function filteredList() {
    const q = (search.value || "").trim().toLowerCase();
    return cache.filter((r) => {
      const hay = `${r.Name || ""} ${r.PhoneNumber || ""} ${r.Website || ""}`.toLowerCase();
      return !q || hay.includes(q);
    });
  }

  function render() {
    const list = filteredList();
    countLabel.textContent = `${list.length} record(s)`;

    tbody.innerHTML = list
      .map((r) => {
        const website = (r.Website || "").trim();
        const websiteHtml = website
          ? (/^https?:\/\//i.test(website)
              ? `<a class="gold" href="${esc(website)}" target="_blank" rel="noopener">${esc(website)}</a>`
              : `<span>${esc(website)}</span>`)
          : `<span class="mutedSmall">—</span>`;

        return `
          <tr>
            <td>${esc(r.CreatedAt || "")}</td>
            <td>${esc(r.Name || "")}</td>
            <td>${esc(r.PhoneNumber || "")}</td>
            <td>${websiteHtml}</td>
          </tr>
        `;
      })
      .join("");
  }

  function toCSV(rows) {
    const header = ["CreatedAt", "Name", "PhoneNumber", "Website"];
    const escCSV = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.map(escCSV).join(",")];

    for (const r of rows) {
      lines.push([r.CreatedAt, r.Name, r.PhoneNumber, r.Website].map(escCSV).join(","));
    }
    return lines.join("\n");
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function reload() {
    try {
      cache = await sheetGetAll();
      render();
      toast("Loaded.");
    } catch (e) {
      console.error(e);
      toast("Failed to load (check key/deploy).", false);
    }
  }

  // Events
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      name: ($("name").value || "").trim(),
      phoneNumber: ($("phone").value || "").trim(),
      website: normalizeWebsite($("website").value),
    };

    if (!payload.name) return toast("Name required.", false);
    if (!payload.phoneNumber) return toast("Phone required.", false);

    try {
      await sheetAdd(payload);
      form.reset();
      await reload();
      toast("Saved ✅");
    } catch (e) {
      console.error(e);
      toast(String(e.message || "Save failed"), false);
    }
  });

  search.addEventListener("input", render);
  btnRefresh.addEventListener("click", reload);

  btnExportCsv.addEventListener("click", () => {
    const list = filteredList();
    if (!list.length) return toast("No records to export.", false);
    download("concierge-records.csv", toCSV(list));
    toast("CSV exported.");
  });

  // Init
  reload();
})();
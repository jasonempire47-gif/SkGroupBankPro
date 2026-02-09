// wwwroot/js/api.js
(function () {
  // ✅ Production:
  // - If you set a Render custom domain: https://api.skgroup.xyz
  // - Otherwise keep the onrender URL
  window.API_BASE = "https://skgroupbankpro-4.onrender.com"; // or "https://api.skgroup.xyz"

  window.escapeHtml = function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  window.apiFetch = async function apiFetch(path, options = {}) {
    const token = localStorage.getItem("token");

    const headers = { ...(options.headers || {}) };

    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${window.API_BASE}${path}`;

    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (e) {
      // Network/DNS/TLS/CORS preflight failures often land here
      throw new Error(`Network error calling API: ${e?.message || e}`);
    }

    // 204 No Content
    if (res.status === 204) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      // Try to extract a useful error message
      let msg = "";
      try {
        if (ct.includes("application/json")) {
          const j = await res.json();
          msg = j?.message || j?.error || JSON.stringify(j);
        } else {
          msg = await res.text();
        }
      } catch {
        msg = "";
      }
      throw new Error(msg || `HTTP ${res.status} ${res.statusText}`);
    }

    // Non-JSON responses
    if (!ct.includes("application/json")) return await res.text().catch(() => null);

    return await res.json();
  };
})();

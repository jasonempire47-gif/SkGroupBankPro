// wwwroot/js/api.js
(function () {
  // ✅ Netlify UI calls Render API (cross-origin)
  // Keep NO trailing slash
  window.API_BASE = "https://skgroupbankpro-4.onrender.com".replace(/\/+$/, "");

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

    // ✅ Ensure path starts with /
    const p = String(path || "");
    const safePath = p.startsWith("/") ? p : `/${p}`;

    const res = await fetch(`${window.API_BASE}${safePath}`, {
      ...options,
      headers,
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isJson = ct.includes("application/json");

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;

      try {
        if (isJson) {
          const err = await res.json();
          msg =
            err?.message ||
            err?.error ||
            (typeof err === "string" ? err : JSON.stringify(err));
        } else {
          const text = await res.text();
          if (text && text.trim()) msg = text;
        }
      } catch {
        // ignore parse errors
      }

      throw new Error(msg);
    }

    // 204 No Content
    if (res.status === 204) return null;

    // Return JSON if JSON, else text
    return isJson ? await res.json() : await res.text();
  };
})();

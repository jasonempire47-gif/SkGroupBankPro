(function () {
  window.API_BASE = "https://skgroupbankpro-4.onrender.com";

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
      throw new Error(`Network error calling API: ${e?.message || e}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return null;

    return await res.json();
  };
})();

// wwwroot/js/auth.js
(function () {
  // --- helpers ---
  function base() {
    const b = (window.API_BASE || "").trim();
    return b ? b.replace(/\/+$/, "") : "";
  }

  function jwtPayload(token) {
    try {
      const part = (token || "").split(".")[1];
      if (!part) return null;
      const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      // handle UTF-8 safely
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
      return null;
    }
  }

  function getRoleFromToken(token) {
    const p = jwtPayload(token);
    if (!p) return "";
    return (
      p.role ||
      p["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      ""
    );
  }

  // --- public: logout ---
  window.logout = function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    location.href = "index.html";
  };

  // --- public: requireAuth (with role guard) ---
  window.requireAuth = function requireAuth(allowedRoles = null) {
    const token = localStorage.getItem("token");
    if (!token) {
      location.href = "index.html";
      return;
    }

    // Ensure role exists; if missing, derive from JWT
    let role = (localStorage.getItem("role") || "").trim();
    if (!role) {
      role = getRoleFromToken(token);
      if (role) localStorage.setItem("role", role);
    }

    // Optional role restriction
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!role || !allowedRoles.includes(role)) {
        location.href = "index.html";
        return;
      }
    }
  };

  // --- optional: authenticated fetch helper (if you want to use it) ---
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

    const res = await fetch(`${base()}${path}`, { ...options, headers });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }

    // handle empty responses
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  };
})();

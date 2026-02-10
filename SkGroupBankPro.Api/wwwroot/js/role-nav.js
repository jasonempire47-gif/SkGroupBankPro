// wwwroot/js/role-nav.js
(function () {
  function getRole() {
    return (localStorage.getItem("role") || "").trim();
  }

  window.applyNavByRole = function applyNavByRole() {
    const role = getRole();
    document.querySelectorAll("[data-roles]").forEach((el) => {
      const allowed = (el.getAttribute("data-roles") || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      el.style.display = (role && allowed.includes(role)) ? "" : "none";
    });
  };
})();

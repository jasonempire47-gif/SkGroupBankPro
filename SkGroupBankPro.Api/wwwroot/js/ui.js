// wwwroot/js/ui.js
document.addEventListener("DOMContentLoaded", () => {
  const app = document.querySelector(".app");
  const btn = document.getElementById("btnSidebarToggle");

  if (!app) {
    console.warn("App container not found");
    return;
  }

  if (!btn) {
    console.warn("Sidebar toggle button not found");
    return;
  }

  // restore state
  if (localStorage.getItem("sidebarCollapsed") === "1") {
    app.classList.add("sidebar-collapsed");
  }

  btn.addEventListener("click", () => {
    app.classList.toggle("sidebar-collapsed");
    localStorage.setItem(
      "sidebarCollapsed",
      app.classList.contains("sidebar-collapsed") ? "1" : "0"
    );
  });
});

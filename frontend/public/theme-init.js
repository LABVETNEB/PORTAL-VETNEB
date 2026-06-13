(function () {
  try {
    if (window.localStorage.getItem("vetneb-theme-mode") === "dark-gray") {
      document.documentElement.dataset.theme = "dark-gray";
    }
  } catch (e) {}
})();

(function () {
  var theme = "normal";
  var normalThemeColor = "#0c354e";
  var darkGrayThemeColor = "#1c1f21";

  try {
    if (window.localStorage.getItem("vetneb-theme-mode") === "dark-gray") {
      theme = "dark-gray";
    }
  } catch (e) {}

  document.documentElement.dataset.theme = theme;

  function syncThemeColor() {
    var themeColors = document.querySelectorAll('meta[name="theme-color"]');
    var themeColor = themeColors.item(0);

    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.appendChild(themeColor);
    }

    themeColor.content =
      document.documentElement.dataset.theme === "dark-gray"
        ? darkGrayThemeColor
        : normalThemeColor;

    for (var index = 1; index < themeColors.length; index += 1) {
      themeColors.item(index).remove();
    }
  }

  syncThemeColor();

  var observer = new MutationObserver(syncThemeColor);
  observer.observe(document.head, { childList: true });
  window.addEventListener(
    "load",
    function () {
      syncThemeColor();
      observer.disconnect();
    },
    { once: true },
  );
})();

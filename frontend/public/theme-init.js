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
  var isSyncingThemeColor = false;

  function syncThemeColor() {
    if (isSyncingThemeColor) {
      return;
    }

    isSyncingThemeColor = true;
    var themeColors = document.querySelectorAll('meta[name="theme-color"]');
    var themeColor = themeColors.item(0);

    if (!themeColor) {
      isSyncingThemeColor = false;
      return;
    }

    themeColor.content =
      document.documentElement.dataset.theme === "dark-gray"
        ? darkGrayThemeColor
        : normalThemeColor;

    for (var index = 1; index < themeColors.length; index += 1) {
      var duplicate = themeColors.item(index);
      if (duplicate) {
        duplicate.setAttribute("data-vetneb-theme-color-duplicate", "true");
        duplicate.setAttribute("name", "theme-color-duplicate");
      }
    }

    isSyncingThemeColor = false;
  }

  syncThemeColor();
  var observer = new MutationObserver(syncThemeColor);
  observer.observe(document.head, { childList: true });
  window.addEventListener(
    "load",
    function () {
      syncThemeColor();
    },
    { once: true },
  );

  function findPublicRouteControl(target) {
    if (!target || typeof target.closest !== "function") {
      return null;
    }

    return target.closest("[data-public-route-control='true']");
  }

  document.addEventListener(
    "click",
    function (event) {
      if (
        event.defaultPrevented ||
        document.documentElement.dataset.publicRouteControlsHydrated === "true" ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      var control = findPublicRouteControl(event.target);
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") {
        return;
      }

      var href = control.getAttribute("data-public-route-href");
      if (!href || href.charAt(0) !== "/" || href.indexOf("/dashboard") === 0) {
        return;
      }

      event.preventDefault();
      if (control.getAttribute("data-public-route-replace") === "true") {
        window.location.replace(href);
        return;
      }

      window.location.assign(href);
    },
    true,
  );
})();

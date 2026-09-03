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

      // Per-control marker, not the page-wide hydration flag: a sibling
      // control can hydrate first and stamp the global flag while this exact
      // node is still waiting its turn, which would wrongly stand this
      // fallback down for a click that is still unrecoverable.
      if (control.getAttribute("data-public-route-control-hydrated") === "true") {
        return;
      }

      var href = control.getAttribute("data-public-route-href");
      if (!href) {
        return;
      }

      // Second, independent same-origin check: PublicRouteControl already
      // filters the href before it ever reaches this attribute, but this
      // fallback does not trust that filtering alone. `href.charAt(0) === "/"`
      // is not proof of same-origin — "//attacker.example" also starts with
      // "/" and is a protocol-relative URL, and the parser below normalizes
      // several other disguises (a leading "/\", embedded tabs/newlines) to
      // the same thing. Resolving against the real page origin and comparing
      // is what actually proves it, and navigating to the resolved URL
      // (rather than the raw attribute) removes any gap between what was
      // checked and what runs.
      var target;
      try {
        target = new URL(href, window.location.href);
      } catch (error) {
        return;
      }

      if (target.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      // Capture phase, ahead of any listener React attaches on a descendant:
      // stopping propagation here keeps this native event from ever reaching
      // React, so it cannot be queued and replayed once hydration catches up
      // — the one thing standing between this fallback and a double
      // navigation.
      event.stopPropagation();

      if (control.getAttribute("data-public-route-replace") === "true") {
        window.location.replace(target.href);
        return;
      }

      window.location.assign(target.href);
    },
    true,
  );
})();

"use client";

const MAIN_CONTENT_ID = "main-content";

export function SkipToContent() {
  const focusMainContent = () => {
    const main = document.getElementById(MAIN_CONTENT_ID);

    if (!main) {
      return;
    }

    const hadTabIndex = main.hasAttribute("tabindex");
    const removeTemporaryTabIndex = () => {
      main.removeAttribute("tabindex");
    };

    if (!hadTabIndex) {
      main.setAttribute("tabindex", "-1");
      main.addEventListener("blur", removeTemporaryTabIndex, { once: true });
    }

    main.focus({ preventScroll: true });

    if (document.activeElement !== main) {
      if (!hadTabIndex) {
        main.removeEventListener("blur", removeTemporaryTabIndex);
        removeTemporaryTabIndex();
      }
      return;
    }

    main.scrollIntoView({ block: "start" });
  };

  return (
    <button
      type="button"
      className="skip-to-content-link"
      aria-controls={MAIN_CONTENT_ID}
      onClick={focusMainContent}
    >
      Saltar al contenido principal
    </button>
  );
}

"use client";

// D-01: a failure in the root layout itself. It replaces the whole document,
// so it carries its own document and inline styles (globals.css does not
// reach it). The copy is fixed: neither the error's message nor its digest
// reaches the DOM.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#0f2d3e",
        }}
      >
        <title>Portal VETNEB</title>
        <main role="alert" data-route-error-boundary="global" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>No pudimos cargar Portal VETNEB</h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: "12px 0 24px" }}>
            Ocurrió un problema al cargar el contenido. Reintentá para volver a cargarlo.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: "inherit",
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              background: "#0f2d3e",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}

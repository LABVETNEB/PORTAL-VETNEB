"use client";

/* eslint-disable @next/next/no-img-element -- signed document URLs must not pass through image optimization */

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PdfSession } from "./pdfjs-client";
import { validateDocumentSource, type DocumentSource, type TrustedDocumentPolicy } from "./document-source";
import { ViewerToolbar, type ViewerToolbarProps } from "./ViewerToolbar";

export type DocumentViewerProps = TrustedDocumentPolicy & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  source: DocumentSource | null;
  onDownload?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type ViewerState = "empty" | "loading" | "ready" | "error" | "fallback";

export function DocumentViewer({ open, onOpenChange, title, source, trustedOrigins, onDownload, returnFocusRef }: DocumentViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<PdfSession | null>(null);
  const [state, setState] = useState<ViewerState>("empty");
  const [page, setPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [retry, setRetry] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const sourcePresent = source !== null;
  const safe = !!source && validateDocumentSource(source, { trustedOrigins });
  const kind = safe ? source.kind : undefined;
  const url = safe ? source.url : undefined;

  useEffect(() => {
    if (!open) return;
    const onChange = () => setFullscreen(document.fullscreenElement === dialogRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [open]);

  useEffect(() => {
    if (!open) { setState("empty"); setNumPages(0); setPage(1); setRenderedPage(0); setZoom(1); setRendering(false); return; }
    setPage(1); setRenderedPage(0); setZoom(1); setNumPages(0); setRendering(false);
    if (!sourcePresent) { setState("empty"); return; }
    if (!safe || !url || !kind) { setState("fallback"); return; }
    if (kind === "image") { setState("loading"); setNumPages(1); return; }
    let active = true;
    const session = new PdfSession();
    sessionRef.current = session;
    setState("loading");
    void session.load(url).then((count) => {
      if (!active) return;
      if (count < 1) { setState("empty"); return; }
      setNumPages(count);
      setState("ready");
    }).catch(() => { if (active) setState("error"); });
    return () => {
      active = false;
      if (sessionRef.current === session) sessionRef.current = null;
      void session.destroy().catch(() => {});
    };
  }, [open, sourcePresent, safe, kind, url, retry]);

  useEffect(() => {
    if (!open || kind !== "pdf" || state !== "ready" || !canvasRef.current || !sessionRef.current) return;
    let active = true;
    const session = sessionRef.current;
    setRendering(true);
    void session.render(canvasRef.current, page, zoom).then(() => {
      if (active) { setRenderedPage(page); setRendering(false); }
    }).catch(() => {
      if (active) { setRendering(false); setState("error"); }
    });
    return () => { active = false; };
  }, [open, kind, state, page, zoom, numPages]);

  async function toggleFullscreen() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      if (document.fullscreenElement === dialog) await document.exitFullscreen();
      else if (dialog.requestFullscreen) await dialog.requestFullscreen();
    } catch { setFullscreen(false); }
  }

  const toolbar: ViewerToolbarProps = {
    page, numPages, zoom, busy: state !== "ready" || rendering, fullscreen,
    onPageChange: setPage, onZoomChange: setZoom, onFullscreen: () => { void toggleFullscreen(); },
    onDownload, onClose: () => onOpenChange(false), closeButtonRef: closeRef,
  };

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-vetneb-ink/60" />
      <Dialog.Content ref={dialogRef} data-c15-viewer="true" aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex h-[100dvh] w-screen min-w-0 flex-col overflow-hidden bg-card text-vetneb-ink outline-none"
        onOpenAutoFocus={(event) => {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          closeRef.current?.focus({ preventScroll: true });
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (document.fullscreenElement === dialogRef.current) void document.exitFullscreen().catch(() => {});
          const target = [returnFocusRef?.current, openerRef.current].find((element) => element?.isConnected && element.getClientRects().length > 0 && !element.matches(":disabled"));
          target?.focus({ preventScroll: true });
        }}>
        <div className="flex shrink-0 items-center gap-3 border-b border-vetneb-line px-4 py-2">
          <Dialog.Title id={titleId} className="min-w-0 flex-1 break-words text-base font-semibold">{title}</Dialog.Title>
        </div>
        <ViewerToolbar {...toolbar} />
        <div data-c15-scroll="true" className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain p-4">
          {state === "empty" ? <p role="status">No hay documento para mostrar.</p> : null}
          {state === "fallback" ? <p role="alert">Este documento no se puede mostrar de forma segura.</p> : null}
          {state === "error" ? <div role="alert"><p>No se pudo mostrar el documento.</p><button type="button" className="mt-3 min-h-11 rounded-lg border border-vetneb-line px-4 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : null}
          {state === "loading" || rendering ? <p role="status">Cargando documento…</p> : null}
          {kind === "pdf" && state === "ready" ? <canvas ref={canvasRef} aria-label={renderedPage ? `Página ${renderedPage} de ${numPages}` : undefined} aria-hidden={rendering || !renderedPage} role="img" className="mx-auto max-w-none shadow-md" style={{ visibility: rendering || !renderedPage ? "hidden" : "visible" }} /> : null}
          {kind === "image" && url && (state === "loading" || state === "ready") ? <img key={`${url}:${retry}`} src={url} alt={title} className="mx-auto block max-w-full object-contain" style={{ maxHeight: "calc(100dvh - 8rem)", transform: `scale(${zoom})`, transformOrigin: "top center" }} onLoad={() => setState("ready")} onError={() => setState("error")} /> : null}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

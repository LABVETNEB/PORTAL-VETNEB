"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PdfSession } from "./pdfjs-client";

export const MAX_CACHED_THUMBNAILS = 6;

type Props = { session: PdfSession; page: number; numPages: number; onPageChange: (page: number) => void };
type ThumbnailStatus = "pending" | "ready" | "error";

function Thumbnail({ session, pageNumber, selected, numPages, root, remember, onPageChange }: {
  session: PdfSession; pageNumber: number; selected: boolean; numPages: number;
  root: RefObject<HTMLElement | null>; remember: (page: number, clear: () => void) => void;
  onPageChange: (page: number) => void;
}) {
  const tile = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<ThumbnailStatus>("pending");
  const [retry, setRetry] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!tile.current || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root: root.current, rootMargin: "120px" });
    observer.observe(tile.current);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible || !canvas.current || status !== "pending") return;
    const controller = new AbortController();
    let active = true;
    setStatus("pending");
    void session.renderThumbnail(canvas.current, pageNumber, controller.signal).then(() => {
      if (!active) return;
      setStatus("ready");
      remember(pageNumber, () => {
        if (canvas.current) { canvas.current.width = 0; canvas.current.height = 0; }
        setStatus("pending");
        setVersion((value) => value + 1);
      });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof DOMException && error.name === "AbortError") setVersion((value) => value + 1);
      else setStatus("error");
    });
    return () => { active = false; controller.abort(); };
  }, [visible, status, retry, version, session, pageNumber, remember]);

  return <div ref={tile} data-c16-page={pageNumber} className="flex shrink-0 flex-col items-center gap-1 p-1">
    <button type="button" aria-label={`Ir a página ${pageNumber} de ${numPages}`} aria-current={selected ? "page" : undefined}
      onClick={() => onPageChange(pageNumber)}
      className={`flex min-h-11 w-28 flex-col items-center justify-center rounded-lg border-2 p-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-vetneb-surface-muted" : "border-vetneb-line"}`}>
      <canvas ref={canvas} width={0} height={0} aria-hidden="true" className={status === "ready" ? "max-h-32 max-w-24" : "hidden"} />
      {status === "pending" ? <span role="status">Cargando miniatura…</span> : null}
      {status === "error" ? <span>Miniatura no disponible</span> : null}
      <span>Página {pageNumber}</span>
    </button>
    {status === "error" ? <button type="button" className="min-h-11 rounded-lg px-2 text-xs underline focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`Reintentar miniatura de página ${pageNumber}`} onClick={() => { setRetry((value) => value + 1); setStatus("pending"); }}>Reintentar</button> : null}
  </div>;
}

export function ViewerThumbnails({ session, page, numPages, onPageChange }: Props) {
  const strip = useRef<HTMLElement>(null);
  const cache = useRef(new Map<number, () => void>());
  const remember = useCallback((number: number, clear: () => void) => {
    cache.current.delete(number);
    cache.current.set(number, clear);
    if (cache.current.size > MAX_CACHED_THUMBNAILS) {
      const oldest = cache.current.keys().next().value;
      if (oldest !== undefined) { const evict = cache.current.get(oldest); cache.current.delete(oldest); evict?.(); }
    }
  }, []);

  useEffect(() => {
    const root = strip.current;
    const active = root?.querySelector<HTMLElement>(`[data-c16-page="${page}"]`);
    if (!root || !active) return;
    const outer = root.getBoundingClientRect();
    const inner = active.getBoundingClientRect();
    if (window.matchMedia("(min-width: 1024px)").matches) {
      if (inner.top < outer.top) root.scrollTop += inner.top - outer.top;
      else if (inner.bottom > outer.bottom) root.scrollTop += inner.bottom - outer.bottom;
    } else {
      if (inner.left < outer.left) root.scrollLeft += inner.left - outer.left;
      else if (inner.right > outer.right) root.scrollLeft += inner.right - outer.right;
    }
  }, [page]);

  useEffect(() => () => {
    strip.current?.querySelectorAll("canvas").forEach((canvas) => { canvas.width = 0; canvas.height = 0; });
    cache.current.clear();
  }, []);

  return <nav ref={strip} aria-label="Miniaturas del documento" data-c16-thumbnails="true"
    className="flex min-h-0 min-w-0 shrink-0 flex-row overflow-x-auto overflow-y-hidden overscroll-contain border-t border-vetneb-line p-1 lg:w-36 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-l lg:border-t-0">
    {Array.from({ length: numPages }, (_, index) => <Thumbnail key={index + 1} session={session} pageNumber={index + 1}
      selected={page === index + 1} numPages={numPages} root={strip} remember={remember} onPageChange={onPageChange} />)}
  </nav>;
}

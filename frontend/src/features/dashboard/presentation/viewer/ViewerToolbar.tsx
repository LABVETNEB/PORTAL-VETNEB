"use client";

import { ChevronLeft, ChevronRight, Download, Maximize, Minus, Plus, X } from "lucide-react";
import type { Ref } from "react";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.25;

export type ViewerToolbarProps = {
  page: number;
  numPages: number;
  zoom: number;
  busy?: boolean;
  fullscreen?: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFullscreen: () => void;
  onDownload?: () => void;
  onClose: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
};

const button = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium hover:bg-vetneb-surface-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ViewerToolbar({ page, numPages, zoom, busy, fullscreen, onPageChange, onZoomChange, onFullscreen, onDownload, onClose, closeButtonRef }: ViewerToolbarProps) {
  return <div role="toolbar" aria-label="Controles del documento" className="flex flex-wrap items-center justify-end gap-1 border-b border-vetneb-line px-2 py-1">
    <button type="button" className={button} aria-label="Página anterior" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft aria-hidden="true" className="size-5" /></button>
    <span role="status" aria-live="polite" className="min-w-14 text-center text-sm">{numPages ? `${page} / ${numPages}` : "0 / 0"}</span>
    <button type="button" className={button} aria-label="Página siguiente" disabled={busy || numPages === 0 || page >= numPages} onClick={() => onPageChange(page + 1)}><ChevronRight aria-hidden="true" className="size-5" /></button>
    <button type="button" className={button} aria-label="Reducir zoom" disabled={busy || zoom <= MIN_ZOOM} onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}><Minus aria-hidden="true" className="size-5" /></button>
    <span role="status" aria-live="polite" className="min-w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
    <button type="button" className={button} aria-label="Ampliar zoom" disabled={busy || zoom >= MAX_ZOOM} onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}><Plus aria-hidden="true" className="size-5" /></button>
    <button type="button" className={button} aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={onFullscreen}><Maximize aria-hidden="true" className="size-5" /></button>
    {onDownload ? <button type="button" className={button} aria-label="Descargar documento" disabled={busy} onClick={onDownload}><Download aria-hidden="true" className="size-5" /></button> : null}
    <button ref={closeButtonRef} type="button" className={button} aria-label="Cerrar visor" onClick={onClose}><X aria-hidden="true" className="size-5" /></button>
  </div>;
}

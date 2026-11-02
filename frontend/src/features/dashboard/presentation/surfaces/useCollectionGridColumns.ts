"use client";

import { useLayoutEffect, useState } from "react";
import {
  COLLECTION_GRID_GAP_PX,
  COLLECTION_GRID_MIN_TRACK_PX,
  collectionGridColumns,
  collectionGridFit,
} from "./collection-view";

type GridLayout = { width: number | null; fitsDriveGap: boolean };

/** The grid's own content width and whether its rows still fit the canvas at the Drive gap. */
function readGridLayout(node: HTMLElement): GridLayout {
  const style = getComputedStyle(node);
  const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const tracks = style.gridTemplateRows.split(" ").map(parseFloat).filter(Number.isFinite);
  const needed =
    tracks.reduce((sum, track) => sum + track, 0) +
    COLLECTION_GRID_GAP_PX * Math.max(0, tracks.length - 1) +
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom);
  return { width, fitsDriveGap: needed <= node.clientHeight + 0.5 };
}

/**
 * V5 · columns of a collection grid from the width its container really has. It reads the
 * grid's own content box (never `window.innerWidth`) and never touches capacity: rows still
 * come from the measured `limit` of the canvas, and every row is `auto` (F0-D9(B)).
 * `minimumColumns` is the contract floor, so the grid only ever gains columns; `minTrack` is
 * the track a column beyond the floor needs (long names included). `drive` turns the Drive
 * tile geometry on only where it is viable: the container fits `minimumColumns` tracks of
 * `driveTrack` (default `minTrack`) and the rows still fit the canvas at a 16 px gap.
 * Anywhere else the previous geometry stays (explicit fallback).
 */
export function useCollectionGridColumns(
  minimumColumns: number,
  minTrack: number = COLLECTION_GRID_MIN_TRACK_PX,
  driveTrack: number = minTrack,
) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<GridLayout>({ width: null, fitsDriveGap: false });

  useLayoutEffect(() => {
    if (!node) return;
    const read = () => {
      const next = readGridLayout(node);
      setLayout((previous) => (previous.width === next.width && previous.fitsDriveGap === next.fitsDriveGap ? previous : next));
    };
    read();
    // A new page or a new limit changes the rows, not the container: watch tiles and row template too.
    const resize = new ResizeObserver(read);
    resize.observe(node);
    const mutation = new MutationObserver(read);
    mutation.observe(node, { childList: true, attributes: true, attributeFilter: ["style"] });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [node]);

  const { width, fitsDriveGap } = layout;
  return {
    attach: setNode,
    columns: width === null ? minimumColumns : collectionGridColumns(width, minimumColumns, minTrack),
    drive: width !== null && collectionGridFit(width, driveTrack) >= minimumColumns && fitsDriveGap,
  };
}

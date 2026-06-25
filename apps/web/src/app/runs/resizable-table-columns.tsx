"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResizableColumn = {
  id: string;
  cssVariable: `--${string}`;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

type ResizableTableColumnsProps = {
  children: ReactNode;
  columns: ResizableColumn[];
  fixedWidth?: number;
  storageKey: string;
};

type ColumnWidths = Record<string, number>;
type TableColumnStyle = CSSProperties & Record<`--${string}`, string>;

const resizeStep = 16;

export function ResizableTableColumns({
  children,
  columns,
  fixedWidth = 0,
  storageKey
}: ResizableTableColumnsProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const columnMap = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);
  const defaultWidths = useMemo(() => getDefaultWidths(columns), [columns]);
  const [widths, setWidths] = useState<ColumnWidths>(defaultWidths);
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    setWidths(loadStoredWidths(storageKey, columnMap, defaultWidths));
    setStorageLoaded(true);
  }, [columnMap, defaultWidths, storageKey]);

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // Ignore storage failures so resizing still works in restricted contexts.
    }
  }, [storageKey, storageLoaded, widths]);

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const column = columnMap.get(columnId);

      if (!column) {
        return;
      }

      setWidths((current) => ({
        ...current,
        [columnId]: clamp(width, column.minWidth, column.maxWidth)
      }));
    },
    [columnMap]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const handle = getResizeHandle(event.target, wrapperRef.current);
      const columnId = handle?.dataset.columnResizer;
      const column = columnId ? columnMap.get(columnId) : undefined;

      if (!handle || !columnId || !column) {
        return;
      }

      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);

      const startX = event.clientX;
      const startWidth = widths[columnId] ?? column.defaultWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setColumnWidth(columnId, startWidth + moveEvent.clientX - startX);
      };

      const cleanup = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [columnMap, setColumnWidth, widths]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const handle = getResizeHandle(event.target, wrapperRef.current);
      const columnId = handle?.dataset.columnResizer;
      const column = columnId ? columnMap.get(columnId) : undefined;

      if (!columnId || !column) {
        return;
      }

      const currentWidth = widths[columnId] ?? column.defaultWidth;
      const step = event.shiftKey ? resizeStep * 3 : resizeStep;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setColumnWidth(columnId, currentWidth - step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setColumnWidth(columnId, currentWidth + step);
      } else if (event.key === "Home") {
        event.preventDefault();
        setColumnWidth(columnId, column.minWidth);
      } else if (event.key === "End") {
        event.preventDefault();
        setColumnWidth(columnId, column.maxWidth);
      }
    },
    [columnMap, setColumnWidth, widths]
  );

  const totalWidth = columns.reduce(
    (total, column) => total + (widths[column.id] ?? column.defaultWidth),
    fixedWidth
  );
  const style = columns.reduce<TableColumnStyle>(
    (nextStyle, column) => {
      nextStyle[column.cssVariable] = `${widths[column.id] ?? column.defaultWidth}px`;
      return nextStyle;
    },
    { "--runs-table-width": `${totalWidth}px` } as TableColumnStyle
  );

  return (
    <div
      ref={wrapperRef}
      style={style}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function getDefaultWidths(columns: ResizableColumn[]) {
  return Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth]));
}

function loadStoredWidths(
  storageKey: string,
  columnMap: Map<string, ResizableColumn>,
  defaultWidths: ColumnWidths
) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");

    if (!isRecord(parsed)) {
      return defaultWidths;
    }

    const nextWidths = { ...defaultWidths };

    for (const [columnId, column] of columnMap.entries()) {
      const storedWidth = parsed[columnId];

      if (typeof storedWidth === "number" && Number.isFinite(storedWidth)) {
        nextWidths[columnId] = clamp(storedWidth, column.minWidth, column.maxWidth);
      }
    }

    return nextWidths;
  } catch {
    return defaultWidths;
  }
}

function getResizeHandle(target: EventTarget | null, root: HTMLElement | null) {
  if (!(target instanceof Element) || !root) {
    return undefined;
  }

  const handle = target.closest<HTMLElement>("[data-column-resizer]");

  return handle && root.contains(handle) ? handle : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

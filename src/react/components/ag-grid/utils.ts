import type { GridApi, RowSelectionOptions } from "ag-grid-community";

export function normalizeRowSelection<TData>(
  rowSelection?: RowSelectionOptions<TData> | "single" | "multiple"
) {
  if (rowSelection === "single") {
    return { mode: "singleRow" as const };
  }

  if (rowSelection === "multiple") {
    return { mode: "multiRow" as const };
  }

  return rowSelection;
}

export function readMaybeRef<T>(value: T | { value: T } | undefined, fallback: T): T {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }

  return (value as T | undefined) ?? fallback;
}

export function getAutoGridHeight(container: HTMLElement) {
  return window.innerHeight - container.getBoundingClientRect().top - 25;
}

export function selectViewportRows<TData>(
  api: GridApi<TData>,
  selected: boolean
) {
  const lastDisplayedRowIndex = api.getLastDisplayedRowIndex();

  for (let index = 0; index <= lastDisplayedRowIndex; index += 1) {
    api.getDisplayedRowAtIndex(index)?.setSelected(selected);
  }
}

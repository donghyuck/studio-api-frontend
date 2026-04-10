import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardedRef,
} from "react";
import { IconButton, Stack, Typography } from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { PropertyOwnerType } from "@/react/api/properties";
import { GridContent } from "@/react/components/ag-grid/GridContent";
import { validatePropertyKey } from "@/react/utils/propertyKeys";

type PropertyRow = {
  id: string;
  key: string;
  value: string;
  keyError?: string | null;
};

interface Props {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  type?: PropertyOwnerType;
  resetKey?: string | number;
}

export interface PropertiesEditorHandle {
  addRow: () => void;
  hasErrors: () => boolean;
  getValue: () => Record<string, string>;
}

function toRows(value: Record<string, string>) {
  return Object.entries(value).map(([key, rowValue], index) => ({
    id: `row-${index}`,
    key,
    value: rowValue,
    keyError: null,
  }));
}

function toMap(rows: PropertyRow[]) {
  const next: Record<string, string> = {};
  rows.forEach((row) => {
    const normalizedKey = row.key.trim();
    if (!normalizedKey || row.keyError) {
      return;
    }
    next[normalizedKey] = row.value;
  });
  return next;
}

function validateRows(rows: PropertyRow[], type: PropertyOwnerType) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const normalizedKey = row.key.trim();
    if (!normalizedKey) {
      return;
    }
    counts.set(normalizedKey, (counts.get(normalizedKey) ?? 0) + 1);
  });

  return rows.map((row) => {
    const normalizedKey = row.key.trim();
    const keyError = validatePropertyKey(normalizedKey, type);
    if (keyError) {
      return { ...row, keyError };
    }

    return {
      ...row,
      keyError: (counts.get(normalizedKey) ?? 0) > 1 ? ("duplicate" as const) : null,
    };
  });
}

function createEmptyRow(index: number): PropertyRow {
  return {
    id: `new-${Date.now()}-${index}`,
    key: "",
    value: "",
    keyError: "키를 입력해 주세요.",
  };
}

function ActionsCell({
  data,
  disabled,
  onDelete,
}: {
  data: PropertyRow;
  disabled: boolean;
  onDelete: (rowId: string) => void;
}) {
  return (
    <IconButton
      size="small"
      color="error"
      onClick={() => onDelete(data.id)}
      disabled={disabled}
    >
      <DeleteOutlined fontSize="small" />
    </IconButton>
  );
}

function PropertiesEditorInner(
  { value, onChange, disabled = false, type = "users", resetKey }: Props,
  ref: ForwardedRef<PropertiesEditorHandle>
) {
  const [rows, setRows] = useState<PropertyRow[]>(() => validateRows(toRows(value), type));

  useEffect(() => {
    setRows(validateRows(toRows(value), type));
  }, [resetKey, type]);

  function updateRows(
    nextRowsOrUpdater: PropertyRow[] | ((currentRows: PropertyRow[]) => PropertyRow[])
  ) {
    setRows((currentRows) => {
      const nextRows =
        typeof nextRowsOrUpdater === "function"
          ? nextRowsOrUpdater(currentRows)
          : nextRowsOrUpdater;
      const validated = validateRows(nextRows, type);
      onChange(toMap(validated));
      return validated;
    });
  }

  function handleDelete(rowId: string) {
    updateRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  function handleCellValueChanged(rowId: string, field: "key" | "value", nextValue: string) {
    updateRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: nextValue } : row))
    );
  }

  const columnDefs = useMemo<ColDef<PropertyRow>[]>(
    () => [
      {
        field: "key",
        headerName: "키",
        flex: 1,
        editable: !disabled,
        sortable: false,
        filter: false,
        tooltipValueGetter: (params) => params.data?.keyError ?? "",
        cellStyle: (params) =>
          params.data?.keyError
            ? {
                border: "1px solid #d32f2f",
                borderRadius: 4,
                backgroundColor: "rgba(211, 47, 47, 0.06)",
              }
            : undefined,
      },
      {
        field: "value",
        headerName: "값",
        flex: 1.4,
        editable: !disabled,
        sortable: false,
        filter: false,
      },
      {
        colId: "actions",
        headerName: "",
        width: 64,
        maxWidth: 64,
        editable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<PropertyRow>) =>
          params.data ? (
            <ActionsCell
              data={params.data}
              disabled={disabled}
              onDelete={handleDelete}
            />
          ) : null,
      },
    ],
    [disabled]
  );

  useImperativeHandle(
    ref,
    () => ({
      addRow: () => {
        updateRows((currentRows) => [...currentRows, createEmptyRow(currentRows.length)]);
      },
      hasErrors: () => rows.some((row) => row.keyError != null),
      getValue: () => toMap(validateRows(rows, type)),
    }),
    [rows, type]
  );

  return (
    <Stack spacing={1}>
      <GridContent<PropertyRow>
        rowData={rows}
        columns={columnDefs}
        height={220}
        options={{
          stopEditingWhenCellsLoseFocus: true,
          suppressCellFocus: false,
          singleClickEdit: true,
          getRowId: (params) => params.data.id,
          onCellValueChanged: (event) => {
            const field = event.colDef.field as "key" | "value" | undefined;
            if (!field || !event.data) {
              return;
            }
            handleCellValueChanged(event.data.id, field, String(event.newValue ?? ""));
          },
        }}
      />
      {rows.some((row) => row.keyError != null) ? (
        <Typography variant="caption" color="error">
          빈 키, 중복 키, 형식 오류, 예약 prefix 키는 저장에서 제외됩니다.
        </Typography>
      ) : null}
    </Stack>
  );
}

export const PropertiesEditor = forwardRef(PropertiesEditorInner);

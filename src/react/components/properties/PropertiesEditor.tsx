import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { IconButton, Stack, Typography } from "@mui/material";
import { DeleteOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid/GridContent";

type PropertyRow = {
  id: string;
  key: string;
  value: string;
  keyError?: "required" | "duplicate" | null;
};

interface Props {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  hideDefaultAddAction?: boolean;
  resetKey?: string | number;
}

export interface PropertiesEditorHandle {
  addRow: () => void;
  hasErrors: () => boolean;
}

function toRows(value: Record<string, string>): PropertyRow[] {
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

function validateRows(rows: PropertyRow[]) {
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
    if (!normalizedKey) {
      return { ...row, keyError: "required" as const };
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
    keyError: "required",
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
  { value, onChange, disabled = false, resetKey }: Props,
  ref: React.ForwardedRef<PropertiesEditorHandle>
) {
  const [rows, setRows] = useState<PropertyRow[]>(() => validateRows(toRows(value)));

  useEffect(() => {
    const nextRows = validateRows(
      Object.entries(value).map(([key, rowValue], index) => ({
        id: `row-${index}`,
        key,
        value: rowValue,
        keyError: null,
      }))
    );
    setRows(nextRows);
  }, [resetKey]);

  function updateRows(nextRows: PropertyRow[]) {
    const validated = validateRows(nextRows);
    setRows(validated);
    const nextValue = toMap(validated);
    onChange(nextValue);
  }

  function handleDelete(rowId: string) {
    updateRows(rows.filter((row) => row.id !== rowId));
  }

  function handleCellValueChanged(rowId: string, field: "key" | "value", nextValue: string) {
    updateRows(
      rows.map((row) => (row.id === rowId ? { ...row, [field]: nextValue } : row))
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
        cellStyle: (params) =>
          params.data?.keyError
            ? { border: "1px solid #d32f2f", borderRadius: 4 }
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
        sortable: false,
        filter: false,
        editable: false,
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
    [disabled, rows]
  );

  useImperativeHandle(
    ref,
    () => ({
      addRow: () => {
        updateRows([...rows, createEmptyRow(rows.length)]);
      },
      hasErrors: () => rows.some((row) => row.keyError != null),
    }),
    [rows]
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
          빈 키 또는 중복 키는 저장에서 제외됩니다.
        </Typography>
      ) : null}
    </Stack>
  );
}

export const PropertiesEditor = forwardRef(PropertiesEditorInner);

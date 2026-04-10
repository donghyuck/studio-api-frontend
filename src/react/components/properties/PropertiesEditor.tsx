import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined } from "@mui/icons-material";

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
  actions?: React.ReactNode;
  onAdd?: () => void;
  hideDefaultAddAction?: boolean;
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
    if (!normalizedKey) {
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

function createEmptyRow() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    key: "",
    value: "",
    keyError: "required" as const,
  };
}

export function PropertiesEditor({
  value,
  onChange,
  disabled = false,
  actions,
  onAdd,
  hideDefaultAddAction = false,
}: Props) {
  const [rows, setRows] = useState<PropertyRow[]>(() => validateRows(toRows(value)));

  useEffect(() => {
    setRows((currentRows) => {
      const nextRows = Object.entries(value).map(([key, rowValue], index) => ({
        id: currentRows[index]?.id ?? `row-${index}`,
        key,
        value: rowValue,
        keyError: null,
      }));
      return validateRows(nextRows);
    });
  }, [value]);

  const hasErrors = useMemo(
    () => rows.some((row) => row.keyError != null),
    [rows]
  );

  function updateRows(nextRows: PropertyRow[]) {
    const validated = validateRows(nextRows);
    setRows(validated);
    if (validated.some((row) => row.keyError != null)) {
      return;
    }
    onChange(toMap(validated));
  }

  function handleRowChange(id: string, field: "key" | "value", nextValue: string) {
    updateRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: nextValue } : row))
    );
  }

  function handleAddRow() {
    updateRows([...rows, createEmptyRow()]);
  }

  function handleDeleteRow(id: string) {
    updateRows(rows.filter((row) => row.id !== id));
  }

  return (
    <Stack spacing={1}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box />
        {actions ?? (hideDefaultAddAction ? null : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAdd ?? handleAddRow}
            disabled={disabled}
          >
            행 추가
          </Button>
        ))}
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: "35%" }}>키</TableCell>
            <TableCell>값</TableCell>
            <TableCell align="right" sx={{ width: 64 }}>작업</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center">
                <Typography variant="body2" color="text.secondary">
                  등록된 프로퍼티가 없습니다.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={row.key}
                    onChange={(event) => handleRowChange(row.id, "key", event.target.value)}
                    error={row.keyError != null}
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={row.value}
                    onChange={(event) => handleRowChange(row.id, "value", event.target.value)}
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteRow(row.id)}
                    disabled={disabled}
                  >
                    <DeleteOutlined fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {hasErrors ? (
        <Typography variant="caption" color="error">
          빈 키 또는 중복 키가 있으면 저장 시 제외됩니다.
        </Typography>
      ) : null}
    </Stack>
  );
}

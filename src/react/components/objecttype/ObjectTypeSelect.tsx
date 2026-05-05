import { useCallback, useEffect, useMemo, useState } from "react";
import { Autocomplete, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { SxProps, TextFieldProps, Theme } from "@mui/material";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { ObjectTypeDto } from "@/types/studio/objecttype";

const DEFAULT_CACHE_TTL_MS = 60_000;
let cachedObjectTypes: ObjectTypeDto[] | null = null;
let cachedAt = 0;
let pendingObjectTypes: Promise<ObjectTypeDto[]> | null = null;

export type ObjectTypeSelectOption = {
  value: string;
  label: string;
  name?: string;
  code?: string;
  objectType?: number;
};

type ObjectTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  includeAll?: boolean;
  allLabel?: string;
  extraValues?: string[];
  disabled?: boolean;
  fullWidth?: boolean;
  size?: TextFieldProps["size"];
  sx?: SxProps<Theme>;
  textFieldSx?: SxProps<Theme>;
  onOptionsLoaded?: (options: ObjectTypeSelectOption[]) => void;
  cacheTtlMs?: number;
};

export function toObjectTypeOption(item: ObjectTypeDto): ObjectTypeSelectOption {
  return {
    value: String(item.objectType),
    label: `${item.code} #${item.objectType}`,
    name: item.name,
    code: item.code,
    objectType: item.objectType,
  };
}

export function formatObjectTypeValue(value?: string | number | null, options: ObjectTypeSelectOption[] = []) {
  if (value == null || String(value).trim() === "") {
    return "전체";
  }
  const normalized = String(value).trim();
  return options.find((option) => option.value === normalized)?.label ?? normalized;
}

export function ObjectTypeSelect({
  value,
  onChange,
  label = "객체유형",
  placeholder = "전체",
  includeAll = true,
  allLabel = "전체",
  extraValues = [],
  disabled = false,
  fullWidth,
  size = "small",
  sx,
  textFieldSx,
  onOptionsLoaded,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: ObjectTypeSelectProps) {
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [loading, setLoading] = useState(false);

  const loadObjectTypes = useCallback(async (force = false) => {
    const now = Date.now();
    const cacheFresh = cachedObjectTypes && now - cachedAt < cacheTtlMs;
    if (!force && cacheFresh) {
      setObjectTypes(cachedObjectTypes);
      return;
    }

    setLoading(true);
    try {
      pendingObjectTypes ??= reactObjectTypeApi
        .list({ status: "ACTIVE" })
        .then((items) => {
          cachedObjectTypes = items;
          cachedAt = Date.now();
          return items;
        })
        .finally(() => {
          pendingObjectTypes = null;
        });
      setObjectTypes(await pendingObjectTypes);
    } catch {
      if (!cachedObjectTypes) {
        setObjectTypes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheTtlMs]);

  useEffect(() => {
    void loadObjectTypes();
  }, [loadObjectTypes]);

  const options = useMemo<ObjectTypeSelectOption[]>(() => {
    const base = objectTypes.map(toObjectTypeOption);
    const known = new Set(base.map((option) => option.value));
    const extras = extraValues
      .map((item) => String(item).trim())
      .filter((item) => item && !known.has(item))
      .map((item) => ({
        value: item,
        label: `미등록 객체유형 #${item}`,
        name: "현재 Projection 응답에만 포함된 값입니다.",
      }));
    return includeAll ? [{ value: "", label: allLabel, name: "모든 객체유형" }, ...base, ...extras] : [...base, ...extras];
  }, [allLabel, extraValues, includeAll, objectTypes]);

  useEffect(() => {
    onOptionsLoaded?.(options.filter((option) => option.value));
  }, [onOptionsLoaded, options]);

  const selectedOption = options.find((option) => option.value === value) ?? (includeAll ? options[0] : null);

  return (
    <Autocomplete<ObjectTypeSelectOption, false, false, false>
      options={options}
      value={selectedOption}
      onChange={(_, option) => onChange(option?.value ?? "")}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      loading={loading}
      disabled={disabled}
      onOpen={() => void loadObjectTypes()}
      fullWidth={fullWidth}
      size={size}
      sx={sx}
      renderOption={(props, option) => (
        <li {...props} key={option.value || "__all__"}>
          <Stack spacing={0}>
            <Typography variant="body2">{option.label}</Typography>
            {option.name ? (
              <Typography variant="caption" color="text.secondary">
                {option.name}
              </Typography>
            ) : null}
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          sx={textFieldSx}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

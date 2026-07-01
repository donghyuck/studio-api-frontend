import { useCallback, useEffect, useMemo, useState } from "react";
import { Autocomplete, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { SxProps, TextFieldProps, Theme } from "@mui/material";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";

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
  helperText?: string;
  freeSolo?: boolean;
  includeAttachment?: boolean;
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
  helperText,
  freeSolo = false,
  includeAttachment = false,
}: ObjectTypeSelectProps) {
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadObjectTypes = useCallback(async (force = false) => {
    const now = Date.now();
    const cacheFresh = cachedObjectTypes && now - cachedAt < cacheTtlMs;
    if (!force && cacheFresh) {
      setObjectTypes(cachedObjectTypes);
      return;
    }

    setLoading(true);
    setError(null);
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
      const items = await pendingObjectTypes;
      setObjectTypes(items);
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
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
    
    if (includeAttachment) {
      base.push({
        value: "attachment",
        label: "attachment (첨부파일)",
        name: "시스템 첨부파일 자체 RAG",
      });
    }

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
  }, [allLabel, extraValues, includeAll, objectTypes, includeAttachment]);

  useEffect(() => {
    onOptionsLoaded?.(options.filter((option) => option.value));
  }, [onOptionsLoaded, options]);

  const selectedOption = useMemo(() => {
    const opt = options.find((option) => option.value === value);
    if (opt) return opt;
    if (freeSolo && value) {
      return { value, label: value, name: "" } as ObjectTypeSelectOption;
    }
    return includeAll ? options[0] : null;
  }, [options, value, freeSolo, includeAll]);

  return (
    <Autocomplete<ObjectTypeSelectOption, false, false, boolean>
      freeSolo={freeSolo}
      options={options}
      value={selectedOption}
      onChange={(_, option) => {
        if (typeof option === "string") {
          onChange(option);
        } else if (option && typeof option === "object" && "value" in option) {
          onChange(option.value);
        } else {
          onChange("");
        }
      }}
      onInputChange={freeSolo ? (_, newInputValue) => {
        onChange(newInputValue);
      } : undefined}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        return option.label;
      }}
      isOptionEqualToValue={(option, selectedVal) => {
        const val1 = typeof option === "string" ? option : option?.value;
        const val2 = typeof selectedVal === "string" ? selectedVal : selectedVal?.value;
        return val1 === val2;
      }}
      loading={loading}
      disabled={disabled}
      onOpen={() => void loadObjectTypes()}
      fullWidth={fullWidth}
      size={size}
      sx={sx}
      renderOption={(optionProps, option) => {
        const optionObj = typeof option === "string" ? { value: option, label: option, name: "" } : option;
        return (
          <li {...optionProps} key={optionObj.value || "__all__"}>
            <Stack spacing={0}>
              <Typography variant="body2">{optionObj.label}</Typography>
              {optionObj.name ? (
                <Typography variant="caption" color="text.secondary">
                  {optionObj.name}
                </Typography>
              ) : null}
            </Stack>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          sx={textFieldSx}
          helperText={helperText ?? (error ? "오브젝트 타입 목록을 불러오지 못했습니다." : undefined)}
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

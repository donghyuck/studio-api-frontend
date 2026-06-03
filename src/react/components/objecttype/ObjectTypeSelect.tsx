import { useCallback, useEffect, useMemo, useState } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Autocomplete, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";

type ObjectTypeSelectOption = {
  value: string;
  label: string;
  name?: string;
};

type ObjectTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  includeAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  helperText?: string;
  sx?: SxProps<Theme>;
  freeSolo?: boolean;
  includeAttachment?: boolean;
};

export function ObjectTypeSelect({
  value,
  onChange,
  label = "객체유형",
  placeholder = "전체",
  includeAll = true,
  allLabel = "전체",
  disabled = false,
  fullWidth,
  size = "small",
  helperText,
  sx,
  freeSolo = false,
  includeAttachment = false,
}: ObjectTypeSelectProps) {
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadObjectTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextObjectTypes = await reactObjectTypeApi.list({ status: "ACTIVE" });
      setObjectTypes(nextObjectTypes);
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
      setObjectTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadObjectTypes();
  }, [loadObjectTypes]);

  const options = useMemo<ObjectTypeSelectOption[]>(() => {
    const base = objectTypes.map((item) => ({
      value: String(item.objectType),
      label: `${item.code} #${item.objectType}`,
      name: item.name,
    }));
    if (includeAttachment) {
      base.push({
        value: "attachment",
        label: "attachment (첨부파일)",
        name: "시스템 첨부파일 자체 RAG",
      });
    }
    return includeAll
      ? [{ value: "", label: allLabel, name: "모든 객체유형" }, ...base]
      : base;
  }, [allLabel, includeAll, objectTypes, includeAttachment]);

  const selectedOption = useMemo(() => {
    const opt = options.find((option) => option.value === value);
    if (opt) return opt;
    if (freeSolo) return value;
    return options[0] || null;
  }, [options, value, freeSolo]);

  return (
    <Autocomplete<ObjectTypeSelectOption | string, false, false, boolean>
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
        const val1 = typeof option === "string" ? option : option.value;
        const val2 = typeof selectedVal === "string" ? selectedVal : selectedVal.value;
        return val1 === val2;
      }}
      loading={loading}
      disabled={disabled}
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

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
    return includeAll
      ? [{ value: "", label: allLabel, name: "모든 객체유형" }, ...base]
      : base;
  }, [allLabel, includeAll, objectTypes]);

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <Autocomplete<ObjectTypeSelectOption, false, false, false>
      options={options}
      value={selectedOption}
      onChange={(_, option) => onChange(option?.value ?? "")}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      sx={sx}
      renderOption={(optionProps, option) => (
        <li {...optionProps} key={option.value || "__all__"}>
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

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddOutlined, ChevronRight } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { reactCompanyApi } from "@/react/pages/companies/api";
import { useToast } from "@/react/feedback";
import type { CompanyDto } from "@/types/studio/company";
import { resolveAxiosError } from "@/utils/helpers";

class CompanyDataSource extends ReactPageDataSource<CompanyDto> {
  constructor(private readonly onLoadError: (message: string | null) => void) {
    super("/api/mgmt/companies");
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: { colId: string; sort: "asc" | "desc" }[];
  }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort =
      (sortModel ?? []).length > 0
        ? `${sortModel![0].colId},${sortModel![0].sort}`
        : undefined;
    try {
      const response = await reactCompanyApi.list({
        page,
        size,
        sort,
        q: typeof this.filter.q === "string" ? this.filter.q : undefined,
      });
      this.onLoadError(null);

      return {
        rows: response.content ?? [],
        total: response.totalElements ?? 0,
      };
    } catch (error) {
      this.onLoadError(resolveCompanyListError(error));
      return { rows: [], total: 0 };
    }
  }
}

function companyStatusLabel(status?: string | null) {
  if (status === "ACTIVE") return "활성";
  if (status === "ARCHIVED") return "비활성";
  return status ?? "-";
}

function companyStatusColor(status?: string | null) {
  return status === "ACTIVE" ? "success" : "default";
}

function resolveCompanyListError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 500) {
    return "Company 목록 API에서 서버 오류가 발생했습니다.";
  }
  return resolveAxiosError(error) || "Company 목록을 불러오지 못했습니다.";
}

function parseProperties(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("속성은 JSON object여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

function CompanyCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    domainName: "",
    description: "",
    propertiesText: "{}",
  });
  const valid = form.name.trim() && form.displayName.trim();

  async function handleSubmit() {
    if (!valid) return;
    let properties: Record<string, unknown>;
    try {
      properties = parseProperties(form.propertiesText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "속성 JSON 형식이 올바르지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      await reactCompanyApi.create({
        name: form.name.trim(),
        displayName: form.displayName.trim(),
        domainName: form.domainName.trim() || null,
        description: form.description.trim() || null,
        properties,
      });
      toast.success("Company가 생성되었습니다.");
      setForm({ name: "", displayName: "", domainName: "", description: "", propertiesText: "{}" });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Company 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Company 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            size="small"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            helperText="API 식별용 name입니다."
            fullWidth
          />
          <TextField
            label="표시 이름"
            size="small"
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Domain"
            size="small"
            value={form.domainName}
            onChange={(event) => setForm((current) => ({ ...current, domainName: event.target.value }))}
            fullWidth
          />
          <TextField
            label="설명"
            size="small"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="속성(JSON)"
            size="small"
            value={form.propertiesText}
            onChange={(event) => setForm((current) => ({ ...current, propertiesText: event.target.value }))}
            multiline
            minRows={4}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={!valid || saving}>
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CompanyListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<CompanyDto>>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dataSource = useMemo(() => new CompanyDataSource(setLoadError), []);
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<CompanyDto>[]>(
    () => [
      {
        field: "companyId",
        headerName: "ID",
        width: 82,
        minWidth: 82,
        filter: false,
        sortable: true,
      },
      {
        field: "displayName",
        headerName: "Company",
        flex: 1,
        minWidth: 180,
        filter: false,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<CompanyDto>) => {
          const company = params.data;
          return (
            <Stack spacing={0} sx={{ minWidth: 0 }}>
              <Box
                component="button"
                type="button"
                onClick={() => company?.companyId && navigate(`/admin/companies/${company.companyId}`)}
                sx={{
                  border: 0,
                  p: 0,
                  bgcolor: "transparent",
                  color: "primary.main",
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {params.value || company?.name || "-"}
              </Box>
              <Typography variant="caption" color="text.secondary" noWrap>
                {company?.name ?? ""}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "domainName",
        headerName: "Domain",
        flex: 0.8,
        minWidth: 140,
        filter: false,
        sortable: true,
        valueFormatter: (params) => params.value ?? "-",
      },
      {
        field: "status",
        headerName: "상태",
        width: 100,
        filter: false,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<CompanyDto>) => (
          <Chip
            size="small"
            color={companyStatusColor(params.value as string | null)}
            variant={params.value === "ACTIVE" ? "filled" : "outlined"}
            label={companyStatusLabel(params.value as string | null)}
            sx={{ height: 22 }}
          />
        ),
      },
      {
        field: "modifiedDate",
        headerName: "수정일시",
        flex: 0.8,
        minWidth: 150,
        filter: false,
        sortable: true,
        type: "datetime",
      },
      {
        colId: "actions",
        headerName: "",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        filter: false,
        sortable: false,
        pinned: "right",
        cellRenderer: (params: ICellRendererParams<CompanyDto>) => (
          <Tooltip title="상세">
            <IconButton
              size="small"
              onClick={() => params.data?.companyId && navigate(`/admin/companies/${params.data.companyId}`)}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [navigate]
  );

  function handleSearch() {
    dataSource.applyFilter(searchInput.trim() ? { q: searchInput.trim() } : {});
    gridRef.current?.refresh();
  }

  function handleRefresh() {
    gridRef.current?.refresh();
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["시스템관리", "Company"]}
        label="Company 기본 정보와 멤버 권한을 관리합니다."
        searchPlaceholder="name, 표시 이름, domain 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        actions={
          <Tooltip title="Company 생성">
            <IconButton size="small" onClick={() => setCreateOpen(true)}>
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      <PageableGridContent<CompanyDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
        options={{ tooltipShowDelay: 300 }}
      />
      <CompanyCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
    </Stack>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useToast } from "@/react/feedback";
import { reactCompanyApi } from "@/react/pages/companies/api";
import type { WorkspaceRef, WorkspaceVisibility } from "@/types/studio/workspace";
import type { CompanyDto } from "@/types/studio/company";
import { reactWorkspaceApi } from "@/react/pages/workspaces/api";
import { resolveAxiosError } from "@/utils/helpers";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";

function visibilityLabel(value?: WorkspaceVisibility | null) {
  if (value === "PRIVATE") return "비공개";
  if (value === "INTERNAL") return "내부";
  if (value === "PUBLIC") return "공개";
  return value ?? "-";
}

function readArchivedFilter(params: URLSearchParams) {
  const archived = params.get("archived");
  if (archived === "true" || archived === "false") {
    return archived;
  }
  return archived === "all" ? "" : "false";
}

function readCompanyFilter(params: URLSearchParams) {
  const companyId = params.get("companyId");
  return companyId && /^\d+$/.test(companyId) ? companyId : "";
}

function companyLabel(company?: CompanyDto) {
  return company ? company.displayName || company.name || `Company #${company.companyId}` : "전체";
}

function toWorkspaceFilter(keyword: string, archived: string, companyId: string) {
  return {
    ...(keyword.trim() ? { q: keyword.trim() } : {}),
    ...(archived ? { archived: archived === "true" } : {}),
    ...(companyId ? { companyId: Number(companyId) } : {}),
  };
}

function WorkspaceCreateDialog({
  open,
  companies,
  initialCompanyId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companies: CompanyDto[];
  initialCompanyId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ companyId: string; name: string; slug: string; visibility: WorkspaceVisibility }>({
    companyId: "",
    name: "",
    slug: "",
    visibility: "PRIVATE",
  });
  const slugRegex = /^[a-z0-9][a-z0-9-]*$/;
  const valid = form.companyId && form.name.trim() && slugRegex.test(form.slug);

  useEffect(() => {
    if (!open) return;
    const companyId = initialCompanyId && companies.some((company) => String(company.companyId) === initialCompanyId)
      ? initialCompanyId
      : "";
    setForm({ companyId, name: "", slug: "", visibility: "PRIVATE" });
  }, [companies, initialCompanyId, open]);

  async function handleSubmit() {
    if (!valid) return;
    setSaving(true);
    try {
      await reactWorkspaceApi.createRoot({
        companyId: Number(form.companyId),
        name: form.name.trim(),
        slug: form.slug.trim(),
        visibility: form.visibility,
      });
      toast.success("작업공간이 생성되었습니다.");
      setForm({ companyId: "", name: "", slug: "", visibility: "PRIVATE" });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "작업공간 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Root 작업공간 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField
            label="Company"
            size="small"
            select
            value={form.companyId}
            onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
            helperText="Root 작업공간은 Company를 직접 선택합니다."
            fullWidth
          >
            {companies.map((company) => (
              <MenuItem key={company.companyId} value={String(company.companyId)}>
                {companyLabel(company)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="이름"
            size="small"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Slug"
            size="small"
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            error={Boolean(form.slug && !slugRegex.test(form.slug))}
            helperText={
              form.slug && !slugRegex.test(form.slug)
                ? "소문자 영문, 숫자, 하이픈(-)만 사용 가능하며 첫 글자는 영문 또는 숫자여야 합니다."
                : "영문 소문자, 숫자, 하이픈(-)만 허용 (예: my-workspace)"
            }
            fullWidth
          />
          <TextField
            label="공개 범위"
            size="small"
            select
            value={form.visibility}
            onChange={(event) =>
              setForm((current) => ({ ...current, visibility: event.target.value as WorkspaceVisibility }))
            }
            fullWidth
          >
            <MenuItem value="PRIVATE">비공개</MenuItem>
            <MenuItem value="INTERNAL">내부</MenuItem>
            <MenuItem value="PUBLIC">공개</MenuItem>
          </TextField>
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

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get("q") ?? "";
  const initialArchived = readArchivedFilter(searchParams);
  const initialCompanyId = readCompanyFilter(searchParams);
  const gridRef = useRef<PageableGridContentHandle<WorkspaceRef>>(null);
  const dataSource = useMemo(() => {
    const nextDataSource = new ReactPageDataSource<WorkspaceRef>("/api/mgmt/workspaces");
    nextDataSource.applyFilter(toWorkspaceFilter(initialKeyword, initialArchived, initialCompanyId));
    return nextDataSource;
  }, []);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [archivedInput, setArchivedInput] = useState(initialArchived);
  const [companyInput, setCompanyInput] = useState(initialCompanyId);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
  const [companyAnchorEl, setCompanyAnchorEl] = useState<HTMLElement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const columnDefs = useMemo<ColDef<WorkspaceRef>[]>(
    () => [
      { field: "id", headerName: "ID", width: 56, minWidth: 56, flex: 0, filter: false, sortable: true },
      {
        field: "parentId",
        headerName: "Parent ID",
        width: 96,
        minWidth: 96,
        flex: 0,
        filter: false,
        sortable: true,
        valueFormatter: (params) => (params.value == null ? "-" : String(params.value)),
      },
      {
        field: "companyId",
        headerName: "Company",
        width: 110,
        minWidth: 110,
        filter: false,
        sortable: true,
        valueFormatter: (params) => {
          const company = companies.find((item) => item.companyId === params.value);
          return company ? companyLabel(company) : params.value ? `#${params.value}` : "-";
        },
        tooltipValueGetter: (params) => {
          const company = companies.find((item) => item.companyId === params.value);
          return company ? companyLabel(company) : params.value ? `#${params.value}` : "-";
        },
      },
      {
        field: "name",
        headerName: "이름",
        flex: 1.1,
        minWidth: 140,
        filter: false,
        sortable: true,
        tooltipField: "name",
        cellRenderer: (params: ICellRendererParams<WorkspaceRef>) => (
          <Box
            component="button"
            type="button"
            onClick={() =>
              params.data?.id &&
              navigate(`/application/workspaces/${params.data.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              })
            }
            sx={{
              border: 0,
              p: 0,
              bgcolor: "transparent",
              color: params.data?.archived ? "text.disabled" : "primary.main",
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
            {params.value}
          </Box>
        ),
      },
      {
        field: "path",
        headerName: "Path",
        flex: 1.5,
        minWidth: 140,
        filter: false,
        sortable: true,
        tooltipField: "path",
      },
      {
        field: "visibility",
        headerName: "범위",
        width: 86,
        filter: false,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<WorkspaceRef>) => (
          <Chip
            size="small"
            variant="outlined"
            label={visibilityLabel(params.value as WorkspaceVisibility)}
            sx={{
              fontSize: 11.5,
              fontWeight: 500,
              height: 20,
              borderRadius: "4px",
              borderColor: "divider",
              bgcolor: "action.hover",
              color: "text.secondary",
            }}
          />
        ),
      },
      {
        field: "archived",
        headerName: "상태",
        width: 86,
        filter: false,
        sortable: true,
        cellRenderer: (params: ICellRendererParams<WorkspaceRef>) => {
          const archived = params.value;
          return (
            <Chip
              size="small"
              label={archived ? "비활성" : "활성"}
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                height: 20,
                borderRadius: "4px",
                bgcolor: archived ? "action.hover" : "rgba(46, 125, 50, 0.08)",
                color: archived ? "text.secondary" : "success.main",
                border: "1px solid",
                borderColor: archived ? "divider" : "rgba(46, 125, 50, 0.2)",
              }}
            />
          );
        },
      },
    ],
    [companies, location.pathname, location.search, navigate]
  );

  useEffect(() => {
    reactCompanyApi
      .list({ page: 0, size: 200, sort: "displayName,asc" })
      .then((response) => setCompanies(response.content ?? []))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextKeyword = params.get("q") ?? "";
    const nextArchived = readArchivedFilter(params);
    const nextCompanyId = readCompanyFilter(params);

    setKeywordInput(nextKeyword);
    setArchivedInput(nextArchived);
    setCompanyInput(nextCompanyId);
    dataSource.applyFilter(toWorkspaceFilter(nextKeyword, nextArchived, nextCompanyId));
    gridRef.current?.refresh();
  }, [dataSource, location.search]);

  function applyFilters(searchValue = keywordInput, statusValue = archivedInput, companyValue = companyInput) {
    const trimmedSearch = searchValue.trim();
    const nextParams = new URLSearchParams(searchParams);

    if (trimmedSearch) {
      nextParams.set("q", trimmedSearch);
    } else {
      nextParams.delete("q");
    }

    if (statusValue) {
      nextParams.set("archived", statusValue);
    } else {
      nextParams.set("archived", "all");
    }

    if (companyValue) {
      nextParams.set("companyId", companyValue);
    } else {
      nextParams.delete("companyId");
    }

    if (nextParams.toString() === searchParams.toString()) {
      dataSource.applyFilter(toWorkspaceFilter(trimmedSearch, statusValue, companyValue));
      gridRef.current?.refresh();
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }

  function handleRefresh() {
    gridRef.current?.refresh();
  }

  const statusLabel = archivedInput === "true" ? "비활성" : archivedInput === "false" ? "활성" : "전체";
  const selectedCompany = companies.find((company) => String(company.companyId) === companyInput);
  const selectedCompanyLabel = companyInput ? (selectedCompany ? companyLabel(selectedCompany) : `#${companyInput}`) : "전체";
  return (
    <Stack spacing={0.5}>
      <PageToolbar
        hasGrid
        breadcrumbs={["애플리케이션", "작업공간"]}
        label="작업공간 tree와 멤버 권한을 관리합니다."
        searchPlaceholder="이름, slug, path 검색"
        searchValue={keywordInput}
        onSearchValueChange={setKeywordInput}
        onSearch={applyFilters}
        onRefresh={handleRefresh}
        createButton={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddOutlined fontSize="small" />}
            onClick={() => setCreateOpen(true)}
            sx={{
              height: 32,
              px: 1.5,
              borderRadius: "6px",
              textTransform: "none",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            생성
          </Button>
        }
        filterActions={
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={(event) => setStatusAnchorEl(event.currentTarget)}
              sx={{
                height: 32,
                minWidth: 86,
                px: 1.5,
                whiteSpace: "nowrap",
                color: "text.secondary",
                borderColor: "divider",
                borderRadius: "6px",
                textTransform: "none",
                fontSize: 12.5,
                fontWeight: 500,
                bgcolor: "background.paper",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.disabled",
                },
              }}
            >
              상태: {statusLabel}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={(event) => setCompanyAnchorEl(event.currentTarget)}
              sx={{
                height: 32,
                minWidth: 112,
                px: 1.5,
                whiteSpace: "nowrap",
                color: "text.secondary",
                borderColor: "divider",
                borderRadius: "6px",
                textTransform: "none",
                fontSize: 12.5,
                fontWeight: 500,
                bgcolor: "background.paper",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.disabled",
                },
              }}
            >
              Company: {selectedCompanyLabel}
            </Button>
          </>
        }
      />
      <PageableGridContent<WorkspaceRef>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
        options={{ tooltipShowDelay: 300 }}
      />
      <WorkspaceCreateDialog
        open={createOpen}
        companies={companies}
        initialCompanyId={companyInput}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
      <Menu
        anchorEl={statusAnchorEl}
        open={Boolean(statusAnchorEl)}
        onClose={() => setStatusAnchorEl(null)}
      >
        {[
          ["", "전체"],
          ["false", "활성"],
          ["true", "비활성"],
        ].map(([value, label]) => (
          <MenuItem
            key={value}
            selected={archivedInput === value}
            onClick={() => {
              setArchivedInput(value);
              setStatusAnchorEl(null);
              applyFilters(keywordInput, value);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={companyAnchorEl}
        open={Boolean(companyAnchorEl)}
        onClose={() => setCompanyAnchorEl(null)}
      >
        <MenuItem
          selected={!companyInput}
          onClick={() => {
            setCompanyInput("");
            setCompanyAnchorEl(null);
            applyFilters(keywordInput, archivedInput, "");
          }}
        >
          전체
        </MenuItem>
        {companies.map((company) => (
          <MenuItem
            key={company.companyId}
            selected={companyInput === String(company.companyId)}
            onClick={() => {
              const value = String(company.companyId);
              setCompanyInput(value);
              setCompanyAnchorEl(null);
              applyFilters(keywordInput, archivedInput, value);
            }}
          >
            {companyLabel(company)}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}

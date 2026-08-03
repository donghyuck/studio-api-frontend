import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTreeOutlined,
  AddOutlined,
  DragIndicatorOutlined,
  FolderOutlined,
  FolderSpecialOutlined,
  InsertDriveFileOutlined,
  OpenInNewOutlined,
  TableChartOutlined,
} from "@mui/icons-material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { WorkspaceFilesPanel } from "@/react/pages/workspaces/WorkspaceFilesPanel";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useToast } from "@/react/feedback";
import { reactCompanyApi } from "@/react/pages/companies/api";
import type { WorkspaceRef, WorkspaceTreeNode, WorkspaceVisibility } from "@/types/studio/workspace";
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

  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [treeItems, setTreeItems] = useState<WorkspaceRef[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const loadTreeData = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await reactWorkspaceApi.list({
        page: 0,
        size: 1000,
        q: keywordInput.trim() || undefined,
        archived: archivedInput === "" ? undefined : archivedInput === "true",
        companyId: companyInput ? Number(companyInput) : undefined,
      });
      setTreeItems(res.content ?? []);
    } catch {
      setTreeItems([]);
    } finally {
      setTreeLoading(false);
    }
  }, [keywordInput, archivedInput, companyInput]);

  useEffect(() => {
    if (viewMode === "tree") {
      void loadTreeData();
    }
  }, [viewMode, loadTreeData]);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);

  const selectedWorkspace = useMemo(() => {
    return treeItems.find((item) => item.id === selectedWorkspaceId) ?? null;
  }, [treeItems, selectedWorkspaceId]);

  useEffect(() => {
    if (treeItems.length > 0 && selectedWorkspaceId == null) {
      setSelectedWorkspaceId(treeItems[0].id);
    }
  }, [treeItems, selectedWorkspaceId]);

  const toast = useToast();
  const [draggedWorkspace, setDraggedWorkspace] = useState<WorkspaceRef | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | "root" | null>(null);
  const [changingParent, setChangingParent] = useState(false);

  function isNodeDescendant(dragId: number, targetNode: WorkspaceTreeNode): boolean {
    if (targetNode.workspace.id === dragId) return true;
    return targetNode.children.some((child) => isNodeDescendant(dragId, child));
  }

  async function handleMoveWorkspace(workspaceId: number, newParentId: number | null) {
    if (changingParent) return;
    setChangingParent(true);
    try {
      await reactWorkspaceApi.changeParent(workspaceId, { newParentId });
      toast.success("작업공간의 부모 계층 위치가 변경되었습니다.");
      await loadTreeData();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "작업공간 위치 변경에 실패했습니다.");
    } finally {
      setChangingParent(false);
      setDraggedWorkspace(null);
      setDropTargetId(null);
    }
  }

  const treeNodes = useMemo<WorkspaceTreeNode[]>(() => {
    if (treeItems.length === 0) return [];
    const itemMap = new Map<number, WorkspaceTreeNode>();
    treeItems.forEach((item) => {
      itemMap.set(item.id, { workspace: item, children: [] });
    });

    const roots: WorkspaceTreeNode[] = [];
    treeItems.forEach((item) => {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [treeItems]);

  const allNodeIds = useMemo<string[]>(() => {
    return treeItems.map((item) => String(item.id));
  }, [treeItems]);

  function renderWorkspaceTreeNode(node: WorkspaceTreeNode) {
    const item = node.workspace;
    const hasChildren = node.children.length > 0;
    const company = companies.find((c) => c.companyId === item.companyId);
    const isDraggingMe = draggedWorkspace?.id === item.id;
    const isDropTargetMe = dropTargetId === item.id;

    const isValidDropTarget =
      draggedWorkspace != null &&
      draggedWorkspace.id !== item.id &&
      draggedWorkspace.parentId !== item.id &&
      !isNodeDescendant(draggedWorkspace.id, node);

    const isSelectedMe = selectedWorkspaceId === item.id;

    return (
      <TreeItem
        key={item.id}
        itemId={String(item.id)}
        label={
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            draggable
            onClick={() => setSelectedWorkspaceId(item.id)}
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggedWorkspace(item);
              e.dataTransfer.setData("text/plain", String(item.id));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              setDraggedWorkspace(null);
              setDropTargetId(null);
            }}
            onDragOver={(e) => {
              if (isValidDropTarget) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                if (dropTargetId !== item.id) setDropTargetId(item.id);
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (dropTargetId === item.id) setDropTargetId(null);
            }}
            onDrop={(e) => {
              if (isValidDropTarget && draggedWorkspace) {
                e.preventDefault();
                e.stopPropagation();
                void handleMoveWorkspace(draggedWorkspace.id, item.id);
              }
            }}
            sx={{
              py: 0.75,
              px: 1,
              borderRadius: 1.25,
              width: "100%",
              cursor: isDraggingMe ? "grabbing" : "pointer",
              opacity: isDraggingMe ? 0.4 : 1,
              bgcolor: isSelectedMe
                ? (theme) => (theme.palette.mode === "dark" ? "rgba(144, 202, 249, 0.16)" : "rgba(25, 118, 210, 0.08)")
                : isDropTargetMe
                ? "primary.50"
                : "transparent",
              border: "1.5px solid",
              borderColor: isSelectedMe
                ? "primary.main"
                : isDropTargetMe
                ? "primary.main"
                : "transparent",
              transition: "all 150ms ease",
              "&:hover": {
                bgcolor: isSelectedMe
                  ? (theme) => (theme.palette.mode === "dark" ? "rgba(144, 202, 249, 0.24)" : "rgba(25, 118, 210, 0.12)")
                  : "action.hover",
                "& .drag-handle": { opacity: 1 },
              },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Tooltip title="드래그하여 다른 작업공간의 하위로 이동">
                <DragIndicatorOutlined
                  className="drag-handle"
                  fontSize="small"
                  sx={{
                    color: "text.disabled",
                    opacity: 0.5,
                    cursor: "grab",
                    fontSize: 16,
                  }}
                />
              </Tooltip>
              {item.parentId == null ? (
                <FolderSpecialOutlined color="primary" fontSize="small" />
              ) : (
                <FolderOutlined color="action" fontSize="small" />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: item.parentId == null ? 700 : 500,
                  color: item.archived ? "text.disabled" : "text.primary",
                  fontSize: 13.5,
                }}
              >
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                ({item.slug})
              </Typography>
              {company ? (
                <Chip
                  size="small"
                  label={companyLabel(company)}
                  sx={{ height: 18, fontSize: 10, bgcolor: "action.hover" }}
                />
              ) : null}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {isDropTargetMe && (
                <Chip
                  size="small"
                  color="primary"
                  label="하위로 이동"
                  sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                />
              )}
              <Chip
                size="small"
                variant="outlined"
                label={visibilityLabel(item.visibility)}
                sx={{ height: 20, fontSize: 10.5 }}
              />
              <Chip
                size="small"
                label={item.archived ? "비활성" : "활성"}
                sx={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  height: 20,
                  borderRadius: "4px",
                  bgcolor: item.archived ? "action.hover" : "rgba(46, 125, 50, 0.08)",
                  color: item.archived ? "text.secondary" : "success.main",
                  border: "1px solid",
                  borderColor: item.archived ? "divider" : "rgba(46, 125, 50, 0.2)",
                }}
              />
              {hasChildren && (
                <Chip
                  size="small"
                  label={`하위 ${node.children.length}개`}
                  color="primary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                />
              )}
              <Button
                size="small"
                variant="text"
                endIcon={<OpenInNewOutlined fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/application/workspaces/${item.id}`, {
                    state: { from: `${location.pathname}${location.search}` },
                  });
                }}
                sx={{ fontSize: 11.5, py: 0, px: 1, height: 24, fontWeight: 600 }}
              >
                상세
              </Button>
            </Stack>
          </Stack>
        }
      >
        {node.children.map(renderWorkspaceTreeNode)}
      </TreeItem>
    );
  }

  function handleRefresh() {
    if (viewMode === "tree") {
      void loadTreeData();
    } else {
      gridRef.current?.refresh();
    }
  }

  const statusLabel = archivedInput === "true" ? "비활성" : archivedInput === "false" ? "활성" : "전체";
  const selectedCompany = companies.find((company) => String(company.companyId) === companyInput);
  const selectedCompanyLabel = companyInput ? (selectedCompany ? companyLabel(selectedCompany) : `#${companyInput}`) : "전체";
  return (
    <Stack spacing={0.5}>
      <PageToolbar
        hasGrid={viewMode === "table"}
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
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, next) => next && setViewMode(next)}
              size="small"
              sx={{ height: 32 }}
            >
              <ToggleButton value="tree" sx={{ px: 1.25, py: 0.5 }}>
                <Tooltip title="트리 뷰 (부모-자식 계층 구조)">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AccountTreeOutlined fontSize="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11.5 }}>트리</Typography>
                  </Stack>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="table" sx={{ px: 1.25, py: 0.5 }}>
                <Tooltip title="테이블 뷰 (그리드 목록)">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <TableChartOutlined fontSize="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11.5 }}>테이블</Typography>
                  </Stack>
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

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

      {viewMode === "table" ? (
        <PageableGridContent<WorkspaceRef>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          options={{ tooltipShowDelay: 300 }}
        />
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 2,
            minHeight: 400,
            bgcolor: "background.paper",
          }}
        >
          {draggedWorkspace && draggedWorkspace.parentId != null && (
            <Paper
              variant="outlined"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTargetId !== "root") setDropTargetId("root");
              }}
              onDragLeave={() => {
                if (dropTargetId === "root") setDropTargetId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleMoveWorkspace(draggedWorkspace.id, null);
              }}
              sx={{
                mb: 2,
                p: 1.5,
                textAlign: "center",
                borderRadius: 2,
                borderStyle: "dashed",
                borderColor: dropTargetId === "root" ? "primary.main" : "divider",
                bgcolor: dropTargetId === "root" ? "primary.50" : "action.hover",
                transition: "all 150ms ease",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: dropTargetId === "root" ? "primary.main" : "text.secondary" }}>
                📌 여기로 드롭하면 최상위(Root) 작업공간으로 이동합니다
              </Typography>
            </Paper>
          )}

          {treeLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
              <CircularProgress size={28} />
            </Box>
          ) : treeNodes.length > 0 ? (
            <SimpleTreeView
              defaultExpandedItems={allNodeIds}
              sx={{
                "& .MuiTreeItem-content": {
                  borderRadius: 1.5,
                  my: 0.25,
                  "&:hover": { bgcolor: "action.hover" },
                  "&.Mui-selected": { bgcolor: "action.selected" },
                },
              }}
            >
              {treeNodes.map(renderWorkspaceTreeNode)}
            </SimpleTreeView>
          ) : (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography color="text.secondary" variant="body2">
                조회된 작업공간이 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {viewMode === "tree" && (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: "background.paper" }}>
          {selectedWorkspace ? (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <InsertDriveFileOutlined color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>
                    [{selectedWorkspace.name}] 소속 파일 목록
                  </Typography>
                  <Chip size="small" label={selectedWorkspace.slug} sx={{ height: 20, fontSize: 11 }} />
                  <Chip size="small" variant="outlined" label={`ID: #${selectedWorkspace.id}`} sx={{ height: 20, fontSize: 10.5 }} />
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewOutlined fontSize="small" />}
                  onClick={() =>
                    navigate(`/application/workspaces/${selectedWorkspace.id}`, {
                      state: { from: `${location.pathname}${location.search}` },
                    })
                  }
                  sx={{ fontSize: 12, height: 28 }}
                >
                  작업공간 상세 이동
                </Button>
              </Stack>

              <WorkspaceFilesPanel workspaceId={selectedWorkspace.id} />
            </Stack>
          ) : (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">
                💡 상단 트리에서 작업공간을 선택하면 하단에 소속 파일 목록이 표시됩니다.
              </Typography>
            </Box>
          )}
        </Paper>
      )}
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

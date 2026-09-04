import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  DriveFileMoveOutlined,
  DeleteOutlined,
  GroupAddOutlined,
  RefreshOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { GridContent } from "@/react/components/ag-grid";
import type { GridContentHandle } from "@/react/components/ag-grid/types";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { SkeletonPlaceholder } from "@/react/components/common/SkeletonPlaceholder";
import { useConfirm, useToast } from "@/react/feedback";
import { UserSearchDialog } from "@/react/pages/admin/UserSearchDialog";
import { reactUsersApi } from "@/react/pages/admin/users/api";
import { reactWorkspaceApi } from "@/react/pages/workspaces/api";
import { WorkspaceWikiPanel } from "@/react/pages/workspaces/WorkspaceWikiPanel";
import { WorkspaceFilesPanel } from "@/react/pages/workspaces/WorkspaceFilesPanel";
import type { PageResponse } from "@/types/studio/api-common";
import type { UserDto } from "@/types/studio/user";
import type {
  WorkspaceCreateRequest,
  WorkspaceMemberRef,
  WorkspacePermissionDefinition,
  WorkspacePermissionSummary,
  WorkspaceRef,
  WorkspaceRole,
  WorkspaceTreeNode,
  WorkspaceVisibility,
} from "@/types/studio/workspace";
import { resolveAxiosError } from "@/utils/helpers";

type DetailTab = "tree" | "members" | "effective" | "permissions" | "wiki" | "files";
type StatusAction = "activate" | "deactivate";

const roleOptions: WorkspaceRole[] = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const visibilityOptions: WorkspaceVisibility[] = ["PRIVATE", "INTERNAL", "PUBLIC"];
const memberPageSize = 10;

function visibilityLabel(value?: WorkspaceVisibility | null) {
  if (value === "PRIVATE") return "비공개";
  if (value === "INTERNAL") return "내부";
  if (value === "PUBLIC") return "공개";
  return value ?? "-";
}

function roleLabel(value?: WorkspaceRole | null) {
  if (value === "VIEWER") return "Viewer";
  if (value === "EDITOR") return "Editor";
  if (value === "ADMIN") return "Admin";
  if (value === "OWNER") return "Owner";
  return value ?? "-";
}

function WorkspacePermissionMatrix({
  actions,
  summary,
}: {
  actions: WorkspacePermissionDefinition[];
  summary: WorkspacePermissionSummary | null;
}) {
  const grantedActionSet = useMemo(() => new Set(summary?.actions ?? []), [summary?.actions]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1">내 권한</Typography>
          <Chip size="small" color="primary" label={roleLabel(summary?.effectiveRole)} />
          <Typography variant="caption" color="text.secondary">
            User #{summary?.userId ?? "-"}
          </Typography>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 640,
              "& th": { whiteSpace: "nowrap" },
              "& td": { borderColor: "divider" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 260 }}>Action</TableCell>
                <TableCell sx={{ minWidth: 260 }}>설명</TableCell>
                <TableCell align="center" sx={{ width: 160 }}>
                  허용 여부
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map((action) => {
                const granted = grantedActionSet.has(action.action);
                return (
                  <TableRow key={action.action} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {action.action}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {action.description ?? ""}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: granted ? "action.hover" : "transparent" }}>
                      <Checkbox
                        size="small"
                        checked={granted}
                        disabled
                        inputProps={{ "aria-label": `내 권한 ${action.action}` }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}

function resolveWorkspaceListPath(state: unknown) {
  if (!state || typeof state !== "object" || !("from" in state)) {
    return "/application/workspaces";
  }

  const from = (state as { from?: unknown }).from;
  return typeof from === "string" && (from === "/application/workspaces" || from.startsWith("/application/workspaces?"))
    ? from
    : "/application/workspaces";
}

function StatItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value ?? "-"}</Typography>
    </Box>
  );
}

function WorkspaceTreeView({ node, currentId }: { node?: WorkspaceTreeNode | null; currentId?: number }) {
  if (!node) {
    return <Typography color="text.secondary">트리 데이터가 없습니다.</Typography>;
  }

  const renderNode = (item: WorkspaceTreeNode) => (
    <TreeItem
      key={item.workspace.id}
      itemId={String(item.workspace.id)}
      label={
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
          <Chip
            size="small"
            variant={item.workspace.id === currentId ? "filled" : "outlined"}
            color={item.workspace.id === currentId ? "primary" : "default"}
            label={item.workspace.depth}
            sx={{ height: 20 }}
          />
          <Typography variant="body2" sx={{ fontWeight: item.workspace.id === currentId ? 700 : 400 }}>
            {item.workspace.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.workspace.path}
          </Typography>
          {item.workspace.archived ? <Chip size="small" variant="outlined" label="비활성" /> : null}
        </Stack>
      }
    >
      {item.children.map(renderNode)}
    </TreeItem>
  );

  return (
    <SimpleTreeView
      defaultExpandedItems={[String(node.workspace.id)]}
      selectedItems={currentId ? String(currentId) : null}
      sx={{
        "& .MuiTreeItem-content": { borderRadius: 1 },
        "& .MuiTreeItem-content.Mui-selected": { bgcolor: "action.selected" },
      }}
    >
      {renderNode(node)}
    </SimpleTreeView>
  );
}

function replaceWorkspaceInTree(
  node: WorkspaceTreeNode | null,
  workspace: WorkspaceRef
): WorkspaceTreeNode | null {
  if (!node) return node;
  return {
    ...node,
    workspace: node.workspace.id === workspace.id ? workspace : node.workspace,
    children: node.children.map((child) => replaceWorkspaceInTree(child, workspace) ?? child),
  };
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: 16,
        height: 16,
        margin: 0,
        accentColor: "#1565c0",
        cursor: "pointer",
        transform: ariaLabel === "행 선택" ? "translateY(2px)" : "none",
      }}
    />
  );
}

function getDisplayedSelectionState(api: {
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
}) {
  const lastIndex = api.getLastDisplayedRowIndex();
  if (lastIndex < 0) {
    return { displayedCount: 0, selectedCount: 0 };
  }

  let displayedCount = 0;
  let selectedCount = 0;
  for (let index = 0; index <= lastIndex; index += 1) {
    const row = api.getDisplayedRowAtIndex(index);
    if (!row) continue;
    displayedCount += 1;
    if (row.isSelected()) selectedCount += 1;
  }
  return { displayedCount, selectedCount };
}

function toggleDisplayedRows(
  api: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  },
  selected: boolean
) {
  const lastIndex = api.getLastDisplayedRowIndex();
  for (let index = 0; index <= lastIndex; index += 1) {
    api.getDisplayedRowAtIndex(index)?.setSelected(selected);
  }
}

function WorkspaceMembersGrid({
  members,
  totalElements,
  page,
  pageSize,
  usersById,
  inherited,
  archived,
  onAdd,
  onChangeRole,
  onRemove,
  onPageChange,
}: {
  members: WorkspaceMemberRef[];
  totalElements: number;
  page: number;
  pageSize: number;
  usersById: Record<number, UserDto | undefined>;
  inherited?: boolean;
  archived?: boolean;
  onAdd?: () => void;
  onChangeRole?: (member: WorkspaceMemberRef, role: WorkspaceRole) => void;
  onRemove?: (members: WorkspaceMemberRef[]) => void;
  onPageChange?: (page: number) => void;
}) {
  const gridRef = useRef<GridContentHandle<WorkspaceMemberRef>>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(0);
  const pageCount = Math.max(1, Math.ceil(totalElements / pageSize));
  const pageNumber = page + 1;

  useEffect(() => {
    setSelectedCount(0);
  }, [members]);

  useEffect(() => {
    if (pageNumber > pageCount) {
      onPageChange?.(pageCount - 1);
      setSelectedCount(0);
    }
  }, [onPageChange, pageCount, pageNumber]);

  function renderHeaderCheckbox(api?: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  }) {
    const currentState = api
      ? getDisplayedSelectionState(api)
      : { displayedCount, selectedCount };
    const allDisplayedSelected =
      currentState.displayedCount > 0 &&
      currentState.selectedCount === currentState.displayedCount;
    const partiallySelected =
      currentState.selectedCount > 0 &&
      currentState.selectedCount < currentState.displayedCount;

    return (
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SelectionCheckbox
          ariaLabel="전체 선택"
          checked={allDisplayedSelected}
          indeterminate={partiallySelected}
          onChange={() => {
            if (api) {
              toggleDisplayedRows(api, !allDisplayedSelected);
            }
          }}
        />
      </Box>
    );
  }

  const columnDefs = useMemo<ColDef<WorkspaceMemberRef>[]>(
    () => [
      ...(inherited
        ? []
        : [
            {
              colId: "rowSelect",
              headerName: "",
              width: 40,
              minWidth: 40,
              maxWidth: 40,
              pinned: "left" as const,
              sortable: false,
              resizable: false,
              suppressMovable: true,
              lockPosition: true,
              cellClass: "selection-column-centered",
              headerClass: "selection-column-centered",
              headerComponent: (props: {
                api: {
                  getLastDisplayedRowIndex: () => number;
                  getDisplayedRowAtIndex: (
                    index: number
                  ) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
                };
              }) => renderHeaderCheckbox(props.api),
              cellRenderer: (params: { node: { isSelected: () => boolean; setSelected: (selected: boolean) => void } }) => (
                <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SelectionCheckbox
                    ariaLabel="행 선택"
                    checked={params.node.isSelected()}
                    onChange={(nextChecked) => params.node.setSelected(nextChecked)}
                  />
                </Box>
              ),
            } satisfies ColDef<WorkspaceMemberRef>,
          ]),
      {
        colId: "username",
        headerName: "아이디",
        flex: 1,
        filter: false,
        sortable: false,
        cellRenderer: (params: { data?: WorkspaceMemberRef }) => {
          const user = params.data?.userId ? usersById[params.data.userId] : undefined;
          const username = user?.username ?? `User #${params.data?.userId ?? "-"}`;
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar
                alt={username}
                src={user?.username ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar` : NO_AVATAR}
                imgProps={{
                  onError: (event) => {
                    event.currentTarget.src = NO_AVATAR;
                  },
                }}
                sx={{ width: 24, height: 24, bgcolor: "grey.200" }}
              />
              <span>{username}</span>
            </Stack>
          );
        },
      },
      {
        colId: "name",
        headerName: "이름",
        flex: 1,
        filter: false,
        sortable: false,
        valueGetter: (params) => (params.data?.userId ? usersById[params.data.userId]?.name : undefined) ?? "",
      },
      {
        colId: "email",
        headerName: "메일",
        flex: 1.2,
        filter: false,
        sortable: false,
        valueGetter: (params) => (params.data?.userId ? usersById[params.data.userId]?.email : undefined) ?? "",
      },
      {
        field: "role",
        headerName: "역할",
        width: inherited ? 120 : 140,
        filter: false,
        sortable: false,
        cellRenderer: (params: { data?: WorkspaceMemberRef; value?: WorkspaceRole }) => {
          const member = params.data;
          if (!member || inherited || !onChangeRole) {
            return (
              <Chip
                size="small"
                variant={member?.inherited ? "outlined" : "filled"}
                color={params.value === "OWNER" ? "primary" : "default"}
                label={roleLabel(params.value)}
              />
            );
          }
          return (
            <TextField
              size="small"
              select
              value={member.role}
              disabled={archived}
              onChange={(event) => onChangeRole(member, event.target.value as WorkspaceRole)}
              SelectProps={{
                MenuProps: {
                  PaperProps: {
                    sx: {
                      "& .MuiMenuItem-root": {
                        minHeight: 28,
                        py: 0.25,
                        fontSize: 13,
                      },
                    },
                  },
                },
              }}
              sx={{
                minWidth: 86,
                "& .MuiInputBase-root": {
                  height: 30,
                  fontSize: 13,
                },
                "& .MuiSelect-select": {
                  py: 0.25,
                  pl: 1,
                  pr: 3,
                },
              }}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role} value={role}>
                  {roleLabel(role)}
                </MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        field: "workspaceId",
        headerName: "작업공간",
        width: 130,
        filter: false,
        sortable: false,
        valueFormatter: (params) => `#${params.value ?? "-"}`,
      },
      {
        field: "inherited",
        headerName: "구분",
        width: 110,
        filter: false,
        sortable: false,
        cellRenderer: (params: { value?: boolean }) => (
          <Chip size="small" variant={params.value ? "outlined" : "filled"} label={params.value ? "상속" : "직접"} />
        ),
      },
    ],
    [archived, displayedCount, inherited, onChangeRole, selectedCount, usersById]
  );

  return (
    <Stack spacing={1}>
      {!inherited ? (
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {totalElements}명
            </Typography>
            <Typography variant="caption" color="text.secondary">
              역할은 선택하면 바로 저장됩니다.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<GroupAddOutlined />} onClick={onAdd} disabled={archived}>
              멤버 추가
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteOutlined />}
              disabled={archived || selectedCount === 0}
              onClick={() => onRemove?.(gridRef.current?.selectedRows() ?? [])}
            >
              선택 멤버 제거
            </Button>
          </Stack>
        </Stack>
      ) : null}
      {members.length === 0 ? (
        <Typography color="text.secondary">표시할 멤버가 없습니다.</Typography>
      ) : (
        <>
          <GridContent<WorkspaceMemberRef>
            ref={gridRef}
            rowData={members}
            columns={columnDefs}
            height={260}
            rowSelection={
              inherited
                ? undefined
                : {
                    mode: "multiRow",
                    enableClickSelection: false,
                    checkboxes: false,
                    headerCheckbox: false,
                  }
            }
            events={[
              {
                type: "selectionChanged",
                listener: (event: SelectionChangedEvent<WorkspaceMemberRef>) => {
                  setSelectedCount(event.api.getSelectedRows().length ?? 0);
                  setDisplayedCount(event.api.getDisplayedRowCount());
                  event.api.refreshHeader?.();
                },
              },
              {
                type: "modelUpdated",
                listener: (event: {
                  api: { getDisplayedRowCount: () => number; refreshHeader?: () => void };
                }) => {
                  setDisplayedCount(event.api.getDisplayedRowCount());
                  event.api.refreshHeader?.();
                },
              },
            ]}
          />
          {totalElements > pageSize ? (
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalElements)} / {totalElements}
              </Typography>
              <Pagination
                size="small"
                count={pageCount}
                page={pageNumber}
                onChange={(_, nextPage) => {
                  onPageChange?.(nextPage - 1);
                  setSelectedCount(0);
                }}
              />
            </Stack>
          ) : null}
        </>
      )}
    </Stack>
  );
}

function WorkspaceCreateChildDialog({
  open,
  parent,
  onClose,
  onCreated,
}: {
  open: boolean;
  parent: WorkspaceRef | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WorkspaceCreateRequest>({
    name: "",
    slug: "",
    visibility: "PRIVATE",
  });
  const slugRegex = /^[a-z0-9][a-z0-9-]*$/;
  const valid = form.name.trim() && slugRegex.test(form.slug);

  useEffect(() => {
    if (open) {
      setForm({ name: "", slug: "", visibility: parent?.visibility ?? "PRIVATE" });
    }
  }, [open, parent?.visibility]);

  async function handleSubmit() {
    if (!parent || !valid) return;
    setSaving(true);
    try {
      await reactWorkspaceApi.createChild(parent.id, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        visibility: form.visibility,
      });
      toast.success("Child 작업공간이 생성되었습니다.");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "Child 작업공간 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Child 작업공간 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField label="Parent" value={parent?.path ?? "-"} size="small" disabled fullWidth />
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
                : "영문 소문자, 숫자, 하이픈(-)만 허용 (예: child-workspace)"
            }
            fullWidth
          />
          <TextField
            label="공개 범위"
            size="small"
            select
            value={form.visibility ?? "PRIVATE"}
            onChange={(event) =>
              setForm((current) => ({ ...current, visibility: event.target.value as WorkspaceVisibility }))
            }
            fullWidth
          >
            {visibilityOptions.map((item) => (
              <MenuItem key={item} value={item}>
                {visibilityLabel(item)}
              </MenuItem>
            ))}
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

function collectTreeIds(node: WorkspaceTreeNode | null): Set<number> {
  const ids = new Set<number>();
  const visit = (item: WorkspaceTreeNode | null) => {
    if (!item) return;
    ids.add(item.workspace.id);
    item.children.forEach(visit);
  };
  visit(node);
  return ids;
}

function WorkspaceParentChangeDialog({
  open,
  workspace,
  tree,
  onClose,
  onChanged,
}: {
  open: boolean;
  workspace: WorkspaceRef | null;
  tree: WorkspaceTreeNode | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<WorkspaceRef[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>("root");

  useEffect(() => {
    if (!open || !workspace) return;
    setSelectedParentId(workspace.parentId == null ? "root" : String(workspace.parentId));
    setLoading(true);
    reactWorkspaceApi
      .list({ page: 0, size: 200, sort: "path,asc" })
      .then((response) => setOptions(response.content ?? []))
      .catch((err) => {
        toast.error(resolveAxiosError(err) || "작업공간 목록을 불러오지 못했습니다.");
        setOptions([]);
      })
      .finally(() => setLoading(false));
  }, [open, toast, workspace]);

  const blockedIds = useMemo(() => collectTreeIds(tree), [tree]);
  const selectableOptions = useMemo(
    () => options.filter((item) => !blockedIds.has(item.id) && !item.archived),
    [blockedIds, options]
  );
  const changed =
    workspace &&
    (selectedParentId === "root" ? workspace.parentId != null : workspace.parentId !== Number(selectedParentId));

  async function handleSubmit() {
    if (!workspace || !changed) return;
    setSaving(true);
    try {
      await reactWorkspaceApi.changeParent(workspace.id, {
        newParentId: selectedParentId === "root" ? null : Number(selectedParentId),
      });
      toast.success("작업공간 Parent가 변경되었습니다.");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "작업공간 Parent 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Parent 작업공간 변경</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField label="현재 작업공간" value={workspace?.path ?? "-"} size="small" disabled fullWidth />
          <TextField
            label="새 Parent"
            size="small"
            select
            value={selectedParentId}
            onChange={(event) => setSelectedParentId(event.target.value)}
            disabled={loading || saving}
            fullWidth
            helperText="변경하면 하위 작업공간의 path, depth, root도 함께 갱신됩니다."
          >
            <MenuItem value="root">Root 작업공간으로 이동</MenuItem>
            {selectableOptions.map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {item.path}
              </MenuItem>
            ))}
          </TextField>
          <Alert severity="warning">
            자기 자신과 하위 Workspace는 Parent로 선택할 수 없습니다. 이동 전 서버 권한과 중복 slug 검사가 다시 수행됩니다.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={!changed || loading || saving}>
          변경
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const confirm = useConfirm();
  const workspaceIdNumber = Number(workspaceId);
  const previousListPath = useMemo(() => resolveWorkspaceListPath(location.state), [location.state]);

  const [tab, setTab] = useState<DetailTab>("tree");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRef | null>(null);
  const [tree, setTree] = useState<WorkspaceTreeNode | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberRef[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(0);
  const [effectiveMembers, setEffectiveMembers] = useState<WorkspaceMemberRef[]>([]);
  const [effectiveMembersTotal, setEffectiveMembersTotal] = useState(0);
  const [effectiveMembersPage, setEffectiveMembersPage] = useState(0);
  const [usersById, setUsersById] = useState<Record<number, UserDto | undefined>>({});
  const [permissionSummary, setPermissionSummary] = useState<WorkspacePermissionSummary | null>(null);
  const [permissionActions, setPermissionActions] = useState<WorkspacePermissionDefinition[]>([]);
  
  // Loading indicators for lazy loading tabs
  const [treeLoading, setTreeLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [effectiveMembersLoading, setEffectiveMembersLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Track loaded status to lazy-load only once
  const [loadedTabs, setLoadedTabs] = useState<Record<DetailTab, boolean>>({
    tree: false,
    members: false,
    effective: false,
    permissions: false,
    wiki: false,
    files: false,
  });

  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [parentDialogOpen, setParentDialogOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [statusCascade, setStatusCascade] = useState(false);
  const [form, setForm] = useState<{ name: string; visibility: WorkspaceVisibility }>({
    name: "",
    visibility: "PRIVATE",
  });

  const archived = Boolean(workspace?.archived);
  const hasChildWorkspaces = Boolean(tree?.children.length);

  const emptyMemberPage = useMemo<PageResponse<WorkspaceMemberRef>>(
    () => ({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: memberPageSize,
      number: 0,
    }),
    []
  );

  // Core metadata loader (on page load or change of workspaceId)
  const loadWorkspaceMeta = useCallback(async () => {
    if (!Number.isFinite(workspaceIdNumber) || workspaceIdNumber <= 0) {
      setError("잘못된 작업공간 ID입니다.");
      setLoading(false);
      return;
    }

    try {
      const nextWorkspace = await reactWorkspaceApi.get(workspaceIdNumber);
      setWorkspace(nextWorkspace);
      setForm({
        name: nextWorkspace.name,
        visibility: nextWorkspace.visibility,
      });
      setError(null);
    } catch (err) {
      setError(resolveAxiosError(err) || "작업공간을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [workspaceIdNumber]);

  // Tab Loaders
  const loadTree = useCallback(async () => {
    if (!Number.isFinite(workspaceIdNumber) || workspaceIdNumber <= 0) return;
    setTreeLoading(true);
    try {
      const nextTree = await reactWorkspaceApi.tree(workspaceIdNumber);
      setTree(nextTree);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "트리 데이터를 불러오지 못했습니다.");
    } finally {
      setTreeLoading(false);
    }
  }, [workspaceIdNumber, toast]);

  const loadMembers = useCallback(async () => {
    if (!Number.isFinite(workspaceIdNumber) || workspaceIdNumber <= 0) return;
    setMembersLoading(true);
    try {
      const nextMembers = await reactWorkspaceApi.members(workspaceIdNumber, {
        page: membersPage,
        size: memberPageSize,
        sort: "userId,asc",
      });
      setMembers(nextMembers.content ?? []);
      setMembersTotal(nextMembers.totalElements ?? 0);

      const userIds = Array.from(
        new Set(
          (nextMembers.content ?? [])
            .map((member) => member.userId)
            .filter((userId): userId is number => typeof userId === "number" && userId > 0)
        )
      );
      if (userIds.length > 0) {
        const userEntries = await Promise.all(
          userIds.map(async (userId) => {
            try {
              return [userId, await reactUsersApi.getUser(userId)] as const;
            } catch {
              return [userId, undefined] as const;
            }
          })
        );
        setUsersById((prev) => ({ ...prev, ...Object.fromEntries(userEntries) }));
      }
    } catch (err) {
      toast.error(resolveAxiosError(err) || "직접 멤버 목록을 불러오지 못했습니다.");
    } finally {
      setMembersLoading(false);
    }
  }, [workspaceIdNumber, membersPage, toast]);

  const loadEffectiveMembers = useCallback(async () => {
    if (!Number.isFinite(workspaceIdNumber) || workspaceIdNumber <= 0) return;
    setEffectiveMembersLoading(true);
    try {
      const nextEffectiveMembers = await reactWorkspaceApi.effectiveMembers(workspaceIdNumber, {
        page: effectiveMembersPage,
        size: memberPageSize,
        sort: "userId,asc",
      });
      setEffectiveMembers(nextEffectiveMembers.content ?? []);
      setEffectiveMembersTotal(nextEffectiveMembers.totalElements ?? 0);

      const userIds = Array.from(
        new Set(
          (nextEffectiveMembers.content ?? [])
            .map((member) => member.userId)
            .filter((userId): userId is number => typeof userId === "number" && userId > 0)
        )
      );
      if (userIds.length > 0) {
        const userEntries = await Promise.all(
          userIds.map(async (userId) => {
            try {
              return [userId, await reactUsersApi.getUser(userId)] as const;
            } catch {
              return [userId, undefined] as const;
            }
          })
        );
        setUsersById((prev) => ({ ...prev, ...Object.fromEntries(userEntries) }));
      }
    } catch (err) {
      toast.error(resolveAxiosError(err) || "유효 멤버 목록을 불러오지 못했습니다.");
    } finally {
      setEffectiveMembersLoading(false);
    }
  }, [workspaceIdNumber, effectiveMembersPage, toast]);

  const loadPermissions = useCallback(async () => {
    if (!Number.isFinite(workspaceIdNumber) || workspaceIdNumber <= 0) return;
    setPermissionsLoading(true);
    try {
      const [nextPermissions, nextActions] = await Promise.all([
        reactWorkspaceApi.permissionsMe(workspaceIdNumber).catch(() => null),
        reactWorkspaceApi.permissionActions(workspaceIdNumber).catch(() => []),
      ]);
      setPermissionSummary(nextPermissions);
      setPermissionActions(nextActions);
    } catch (err) {
      toast.error(resolveAxiosError(err) || "권한 정보를 불러오지 못했습니다.");
    } finally {
      setPermissionsLoading(false);
    }
  }, [workspaceIdNumber, toast]);

  // Context-aware refresh function
  const handleRefresh = useCallback(async () => {
    await loadWorkspaceMeta();
    if (tab === "tree") {
      await loadTree();
    } else if (tab === "members") {
      await loadMembers();
    } else if (tab === "effective") {
      await loadEffectiveMembers();
    } else if (tab === "permissions") {
      await loadPermissions();
    }
  }, [tab, loadWorkspaceMeta, loadTree, loadMembers, loadEffectiveMembers, loadPermissions]);

  // Initial load when page enters or workspaceId changes
  useEffect(() => {
    setLoading(true);
    void loadWorkspaceMeta();
  }, [loadWorkspaceMeta]);

  // Reset page parameters and loaded status when workspace changes
  useEffect(() => {
    setTab("tree");
    setMembersPage(0);
    setEffectiveMembersPage(0);
    setLoadedTabs({
      tree: false,
      members: false,
      effective: false,
      permissions: false,
      wiki: false,
      files: false,
    });
    setTree(null);
    setMembers([]);
    setMembersTotal(0);
    setEffectiveMembers([]);
    setEffectiveMembersTotal(0);
    setPermissionSummary(null);
    setPermissionActions([]);
  }, [workspaceIdNumber]);

  // Trigger loading data on tab click or pagination change
  useEffect(() => {
    if (!workspace) return;

    if (tab === "tree" && !loadedTabs.tree) {
      void loadTree().then(() => setLoadedTabs((prev) => ({ ...prev, tree: true })));
    } else if (tab === "members") {
      void loadMembers().then(() => setLoadedTabs((prev) => ({ ...prev, members: true })));
    } else if (tab === "effective") {
      void loadEffectiveMembers().then(() => setLoadedTabs((prev) => ({ ...prev, effective: true })));
    } else if (tab === "permissions" && !loadedTabs.permissions) {
      void loadPermissions().then(() => setLoadedTabs((prev) => ({ ...prev, permissions: true })));
    }
  }, [
    tab,
    workspace,
    loadedTabs.tree,
    loadedTabs.permissions,
    loadTree,
    loadMembers,
    loadEffectiveMembers,
    loadPermissions,
  ]);

  const permissionActionSet = useMemo(
    () => new Set(permissionSummary?.actions ?? []),
    [permissionSummary?.actions]
  );
  const statusActionLabel = statusAction === "activate" ? "활성화" : "비활성화";
  const statusDialogMessage =
    statusAction === "activate"
      ? `${workspace?.name ?? ""} 작업공간을 활성화하시겠습니까?`
      : `${workspace?.name ?? ""} 작업공간을 비활성화하시겠습니까? 비활성화하면 수정과 멤버 변경이 제한됩니다.`;

  async function handleSave() {
    if (!workspace) return;
    setSaving(true);
    try {
      const saved = await reactWorkspaceApi.update(workspace.id, {
        name: form.name.trim(),
        visibility: form.visibility,
      });
      setWorkspace(saved);
      setForm({ name: saved.name, visibility: saved.visibility });
      setTree((current) => replaceWorkspaceInTree(current, saved));
      toast.success("작업공간이 저장되었습니다.");
    } catch (err) {
      toast.error(resolveAxiosError(err) || "작업공간 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function openStatusDialog(action: StatusAction) {
    setStatusAction(action);
    setStatusCascade(false);
  }

  function closeStatusDialog() {
    if (statusSaving) return;
    setStatusAction(null);
    setStatusCascade(false);
  }

  async function handleStatusChange() {
    if (!workspace || !statusAction) return;

    setStatusSaving(true);
    try {
      const payload = { cascade: hasChildWorkspaces ? statusCascade : false };
      if (statusAction === "activate") {
        await reactWorkspaceApi.activate(workspace.id, payload);
        toast.success("작업공간이 활성화되었습니다.");
      } else {
        await reactWorkspaceApi.archive(workspace.id, payload);
        toast.success("작업공간이 비활성화되었습니다.");
      }
      setStatusAction(null);
      setStatusCascade(false);
      await handleRefresh();
    } catch (err) {
      toast.error(
        resolveAxiosError(err) ||
          (statusAction === "activate" ? "작업공간 활성화에 실패했습니다." : "작업공간 비활성화에 실패했습니다.")
      );
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleAddMembers(selectedUsers: UserDto[]) {
    if (!workspace) return;
    const userIds = Array.from(
      new Set(
        selectedUsers
          .map((user) => user.userId)
          .filter((userId): userId is number => typeof userId === "number")
      )
    );
    if (userIds.length === 0) {
      toast.info("추가할 멤버가 없습니다.");
      return;
    }

    try {
      await Promise.all(userIds.map((userId) => reactWorkspaceApi.addMember(workspace.id, { userId, role: "VIEWER" })));
      toast.success(`${userIds.length}명의 멤버가 추가되었습니다.`);
      await handleRefresh();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "멤버 추가에 실패했습니다.");
    }
  }

  async function handleChangeRole(member: WorkspaceMemberRef, role: WorkspaceRole) {
    if (!workspace) return;
    try {
      await reactWorkspaceApi.changeRole(workspace.id, member.userId, { role });
      toast.success("역할이 변경되었습니다.");
      await handleRefresh();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "역할 변경에 실패했습니다.");
    }
  }

  async function handleRemoveMembers(selectedMembers: WorkspaceMemberRef[]) {
    if (!workspace) return;
    const userIds = selectedMembers
      .map((member) => member.userId)
      .filter((userId): userId is number => typeof userId === "number");
    if (userIds.length === 0) return;

    const ok = await confirm({
      title: "멤버 제거",
      message: `선택된 ${userIds.length}명의 멤버를 제거하시겠습니까?`,
      okText: "제거",
      cancelText: "취소",
    });
    if (!ok) return;

    try {
      await Promise.all(userIds.map((userId) => reactWorkspaceApi.removeMember(workspace.id, userId)));
      toast.success(`${userIds.length}명의 멤버가 제거되었습니다.`);
      await handleRefresh();
    } catch (err) {
      toast.error(resolveAxiosError(err) || "멤버 제거에 실패했습니다.");
    }
  }

  if (loading) {
    return <SkeletonPlaceholder variant="detail" />;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!workspace) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={["애플리케이션", "작업공간", workspace.name]}
        label="작업공간 tree와 멤버 권한을 관리합니다."
        previous
        onPrevious={() => navigate(previousListPath)}
        onRefresh={handleRefresh}
        actions={
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Child 작업공간 생성">
              <span>
                <IconButton size="small" disabled={archived || statusSaving} onClick={() => setChildDialogOpen(true)}>
                  <AddOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Parent 작업공간 변경">
              <span>
                <IconButton size="small" disabled={archived || saving || statusSaving} onClick={() => setParentDialogOpen(true)}>
                  <DriveFileMoveOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        }
      />

      {archived ? <Alert severity="info">비활성화된 작업공간입니다. 수정과 멤버 변경은 제한됩니다.</Alert> : null}

      <Container maxWidth="lg" disableGutters>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5}>
              <TextField
                label="이름"
                size="small"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                disabled={archived || saving || statusSaving}
                fullWidth
              />
              <TextField label="Slug" size="small" value={workspace.slug} disabled fullWidth />
              <TextField label="Path" size="small" value={workspace.path} disabled fullWidth />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <TextField
                label="공개 범위"
                size="small"
                select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({ ...current, visibility: event.target.value as WorkspaceVisibility }))
                }
                disabled={archived || saving || statusSaving}
                fullWidth
              >
                {visibilityOptions.map((item) => (
                  <MenuItem key={item} value={item}>
                    {visibilityLabel(item)}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={2}>
                <StatItem label="ID" value={workspace.id} />
                <StatItem label="Team" value={workspace.teamId ? `#${workspace.teamId}` : "-"} />
                <StatItem label="Root" value={workspace.rootId ?? "-"} />
                <StatItem label="Depth" value={workspace.depth} />
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary">
                현재 상태
              </Typography>
              <Chip
                size="small"
                color={archived ? "default" : "success"}
                variant={archived ? "outlined" : "filled"}
                label={archived ? "비활성" : "활성"}
              />
            </Stack>
          </Grid>
          <Grid size={12} sx={{ mt: 4 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<SaveOutlined />}
                disabled={archived || saving || statusSaving || !form.name.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? <CircularProgress size={20} /> : "저장"}
              </Button>
              <Button
                variant="outlined"
                color={archived ? "primary" : "warning"}
                disabled={saving || statusSaving}
                onClick={() => openStatusDialog(archived ? "activate" : "deactivate")}
              >
                {statusSaving ? <CircularProgress size={20} /> : archived ? "활성화" : "비활성화"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Tabs value={tab} onChange={(_, value: DetailTab) => setTab(value)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="tree" label="트리" />
        <Tab value="members" label="직접 멤버" />
        <Tab value="effective" label="유효 멤버" />
        <Tab value="permissions" label="권한" />
        <Tab value="wiki" label="Wiki" />
        <Tab value="files" label="파일" />
      </Tabs>

      {tab === "tree" ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">작업공간 Tree</Typography>
            <Tooltip title="새로고침">
              <IconButton size="small" onClick={() => void loadTree()}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          {treeLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <WorkspaceTreeView node={tree} currentId={workspace.id} />
          )}
        </Paper>
      ) : null}

      {tab === "members" ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {membersLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <WorkspaceMembersGrid
              members={members}
              totalElements={membersTotal}
              page={membersPage}
              pageSize={memberPageSize}
              usersById={usersById}
              archived={archived}
              onAdd={() => setUserSearchOpen(true)}
              onChangeRole={handleChangeRole}
              onRemove={(selectedMembers) => void handleRemoveMembers(selectedMembers)}
              onPageChange={setMembersPage}
            />
          )}
        </Paper>
      ) : null}

      {tab === "effective" ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {effectiveMembersLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <WorkspaceMembersGrid
              members={effectiveMembers}
              totalElements={effectiveMembersTotal}
              page={effectiveMembersPage}
              pageSize={memberPageSize}
              usersById={usersById}
              inherited
              onPageChange={setEffectiveMembersPage}
            />
          )}
        </Paper>
      ) : null}

      {tab === "permissions" ? (
        permissionsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={30} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <WorkspacePermissionMatrix actions={permissionActions} summary={permissionSummary} />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Action Definitions
                </Typography>
                <Stack spacing={0.75}>
                  {permissionActions.map((action) => (
                    <Stack key={action.action} direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        color={permissionActionSet.has(action.action) ? "success" : "default"}
                        variant={permissionActionSet.has(action.action) ? "filled" : "outlined"}
                        label={action.action}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {action.description ?? ""}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Paper>
          </Stack>
        )
      ) : null}

      {tab === "wiki" ? <WorkspaceWikiPanel workspaceId={workspace.id} archived={archived} /> : null}

      {tab === "files" ? <WorkspaceFilesPanel workspaceId={workspace.id} archived={archived} /> : null}

      <WorkspaceCreateChildDialog
        open={childDialogOpen}
        parent={workspace}
        onClose={() => setChildDialogOpen(false)}
        onCreated={() => void handleRefresh()}
      />
      <WorkspaceParentChangeDialog
        open={parentDialogOpen}
        workspace={workspace}
        tree={tree}
        onClose={() => setParentDialogOpen(false)}
        onChanged={() => void handleRefresh()}
      />
      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        selectionMode="multiple"
        confirmLabel="추가"
        onConfirmSelection={(users) => void handleAddMembers(users)}
      />
      <Dialog open={Boolean(statusAction)} onClose={closeStatusDialog} maxWidth="xs" fullWidth>
        <DialogTitle>작업공간 {statusActionLabel}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <DialogContentText>{statusDialogMessage}</DialogContentText>
            {hasChildWorkspaces ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={statusCascade}
                    disabled={statusSaving}
                    onChange={(event) => setStatusCascade(event.target.checked)}
                  />
                }
                label={`하위 작업공간도 함께 ${statusActionLabel}`}
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStatusDialog} disabled={statusSaving}>
            취소
          </Button>
          <Button variant="contained" onClick={() => void handleStatusChange()} disabled={statusSaving}>
            {statusSaving ? <CircularProgress size={20} /> : statusActionLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

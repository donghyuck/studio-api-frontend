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
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddOutlined, ChevronRight, GroupsOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams, RowClickedEvent, SortModelItem } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { useToast } from "@/react/feedback";
import { reactTeamApi } from "@/react/pages/teams/api";
import type {
  TeamCreateRequest,
  TeamDto,
  TeamJoinPolicy,
  TeamRagReplyMode,
  TeamVisibility,
} from "@/types/studio/team";
import { resolveAxiosError } from "@/utils/helpers";

function visibilityLabel(value: TeamVisibility) {
  if (value === "PUBLIC") return "공용";
  if (value === "UNLISTED") return "링크 전용";
  return "비공개";
}

function replyModeLabel(value: TeamRagReplyMode) {
  if (value === "AUTO") return "자동";
  if (value === "MENTION") return "@AI";
  return "수동";
}

class TeamDataSource extends ReactPageDataSource<TeamDto> {
  constructor(private readonly onLoadError: (message: string | null) => void) {
    super("/api/teams");
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
  }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort = sortModel?.length
      ? `${sortModel[0].colId},${sortModel[0].sort}`
      : "name,asc";

    try {
      const response = await reactTeamApi.list({
        q: typeof this.filter.q === "string" ? this.filter.q : undefined,
        page,
        size,
        sort,
      });
      this.onLoadError(null);
      return {
        rows: response.content ?? [],
        total: response.totalElements ?? 0,
      };
    } catch (error) {
      this.onLoadError(resolveAxiosError(error) || "Team 목록을 불러오지 못했습니다.");
      return { rows: [], total: 0 };
    }
  }
}

const emptyForm: TeamCreateRequest = {
  companyId: null,
  name: "",
  slug: "",
  description: "",
  visibility: "PRIVATE",
  joinPolicy: "INVITE_ONLY",
  ragEnabled: true,
  ragReplyMode: "MENTION",
};

function TeamCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (team: TeamDto) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<TeamCreateRequest>(emptyForm);
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const slugValid = /^[a-z0-9][a-z0-9-]*$/.test(form.slug);
  const valid = Boolean(form.name.trim() && slugValid);

  async function handleCreate() {
    if (!valid) return;
    setSaving(true);
    try {
      const team = await reactTeamApi.create({
        ...form,
        companyId: companyId ? Number(companyId) : null,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description?.trim() || null,
      });
      toast.success("Team이 생성되었습니다.");
      setForm(emptyForm);
      setCompanyId("");
      onCreated(team);
      onClose();
    } catch (error) {
      toast.error(resolveAxiosError(error) || "Team 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Team 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField
            size="small"
            label="이름"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label="Slug"
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            error={Boolean(form.slug && !slugValid)}
            helperText="영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."
            fullWidth
          />
          <TextField
            size="small"
            label="Company ID (선택)"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value.replace(/\D/g, ""))}
            helperText="비워 두면 Company에 속하지 않는 공용 Team으로 생성됩니다."
            fullWidth
          />
          <TextField
            size="small"
            label="설명"
            value={form.description ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="공개 범위"
              value={form.visibility}
              onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as TeamVisibility }))}
              fullWidth
            >
              <MenuItem value="PUBLIC">공용</MenuItem>
              <MenuItem value="UNLISTED">링크 전용</MenuItem>
              <MenuItem value="PRIVATE">비공개</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="가입 정책"
              value={form.joinPolicy}
              onChange={(event) => setForm((current) => ({ ...current, joinPolicy: event.target.value as TeamJoinPolicy }))}
              fullWidth
            >
              <MenuItem value="OPEN">바로 가입</MenuItem>
              <MenuItem value="APPROVAL">승인 필요</MenuItem>
              <MenuItem value="INVITE_ONLY">초대 전용</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="RAG 응답"
              value={form.ragReplyMode}
              onChange={(event) => setForm((current) => ({ ...current, ragReplyMode: event.target.value as TeamRagReplyMode }))}
              fullWidth
            >
              <MenuItem value="MANUAL">수동</MenuItem>
              <MenuItem value="MENTION">@AI 호출</MenuItem>
              <MenuItem value="AUTO">질문 자동</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>취소</Button>
        <Button variant="contained" onClick={() => void handleCreate()} disabled={!valid || saving}>생성</Button>
      </DialogActions>
    </Dialog>
  );
}

export function TeamListPage() {
  const navigate = useNavigate();
  const gridRef = useRef<PageableGridContentHandle<TeamDto>>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const dataSource = useMemo(() => new TeamDataSource(setError), []);

  const columnDefs = useMemo<ColDef<TeamDto>[]>(() => [
    {
      field: "teamId",
      headerName: "ID",
      width: 82,
      minWidth: 82,
      maxWidth: 82,
      filter: false,
      sortable: true,
      type: "numericColumn",
    },
    {
      field: "name",
      headerName: "Team",
      flex: 1,
      minWidth: 220,
      filter: false,
      sortable: true,
      cellRenderer: (params: ICellRendererParams<TeamDto>) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", minWidth: 0 }}>
          <GroupsOutlined color="primary" fontSize="small" />
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Box
              component="button"
              type="button"
              onClick={() => params.data?.teamId && navigate(`/admin/teams/${params.data.teamId}`)}
              sx={{
                border: 0,
                p: 0,
                bgcolor: "transparent",
                color: "primary.main",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 700,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {params.value || "-"}
            </Box>
            <Typography variant="caption" color="text.secondary" noWrap>
              {params.data?.slug ?? ""}
            </Typography>
          </Stack>
        </Stack>
      ),
    },
    {
      field: "visibility",
      headerName: "공개 범위",
      width: 112,
      filter: false,
      sortable: true,
      cellRenderer: (params: ICellRendererParams<TeamDto>) => (
        <Chip size="small" variant="outlined" label={visibilityLabel(params.value as TeamVisibility)} sx={{ height: 22 }} />
      ),
    },
    {
      field: "companyId",
      headerName: "Company",
      width: 110,
      filter: false,
      sortable: true,
      valueFormatter: ({ value }) => value ? `#${value}` : "공용",
    },
    {
      field: "ragReplyMode",
      headerName: "RAG 응답",
      width: 120,
      filter: false,
      sortable: true,
      valueFormatter: ({ data, value }) => data?.ragEnabled ? replyModeLabel(value as TeamRagReplyMode) : "사용 안 함",
    },
    {
      field: "memberCount",
      headerName: "멤버",
      width: 90,
      filter: false,
      sortable: false,
      type: "numericColumn",
      valueFormatter: ({ value }) => value ?? "-",
    },
    {
      field: "knowledgeSourceCount",
      headerName: "자료",
      width: 90,
      filter: false,
      sortable: false,
      type: "numericColumn",
      valueFormatter: ({ value }) => value ?? "-",
    },
    {
      field: "status",
      headerName: "상태",
      width: 100,
      filter: false,
      sortable: true,
      cellRenderer: (params: ICellRendererParams<TeamDto>) => (
        <Chip
          size="small"
          color={params.value === "ACTIVE" ? "success" : "default"}
          variant={params.value === "ACTIVE" ? "filled" : "outlined"}
          label={params.value === "ACTIVE" ? "활성" : "보관"}
          sx={{ height: 22 }}
        />
      ),
    },
    {
      colId: "actions",
      headerName: "",
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pinned: "right",
      filter: false,
      sortable: false,
      cellRenderer: (params: ICellRendererParams<TeamDto>) => (
        <Tooltip title="상세">
          <IconButton
            size="small"
            aria-label={`${params.data?.name ?? "Team"} 상세`}
            onClick={() => params.data?.teamId && navigate(`/admin/teams/${params.data.teamId}`)}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [navigate]);

  function handleSearch(value: string) {
    dataSource.applyFilter(value.trim() ? { q: value.trim() } : {});
    gridRef.current?.refresh();
  }

  function handleRowClicked(event: RowClickedEvent<TeamDto>) {
    if (event.data?.teamId) navigate(`/admin/teams/${event.data.teamId}`);
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        hasGrid
        breadcrumbs={["Application", "Teams"]}
        title="Teams"
        label="Team은 멤버십, Workspace 트리, 채팅 및 RAG 자료의 보안 경계입니다."
        onRefresh={() => gridRef.current?.refresh()}
        searchPlaceholder="Team 이름 또는 slug 검색"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearch={handleSearch}
        createButton={
          <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={() => setCreateOpen(true)}>
            Team 생성
          </Button>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      <PageableGridContent<TeamDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
        onRowClicked={handleRowClicked}
        options={{
          tooltipShowDelay: 300,
          overlayNoRowsTemplate: "표시할 Team이 없습니다.",
        }}
      />

      <TeamCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(team) => navigate(`/admin/teams/${team.teamId}`)}
      />
    </Stack>
  );
}

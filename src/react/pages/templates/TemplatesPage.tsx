import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Stack,
  IconButton,
  Tooltip,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlineOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { CreateTemplateDialog } from "@/react/pages/templates/CreateTemplateDialog";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { TemplateSummaryDto } from "@/types/studio/template";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useConfirm, useToast } from "@/react/feedback";
import { reactTemplatesApi } from "@/react/pages/templates/api";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

class TemplatesDataSource extends ReactPageDataSource<TemplateSummaryDto> {
  constructor() {
    super("/api/mgmt/templates");
  }
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const gridRef = useRef<PageableGridContentHandle<TemplateSummaryDto>>(null);
  const dataSource = useMemo(() => new TemplatesDataSource(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedCount = selectedIds.length;

  useEffect(() => {
    void reactObjectTypeApi
      .list({ status: "ACTIVE" })
      .then(setObjectTypes)
      .catch(() => {});
  }, []);

  const columnDefs = useMemo<ColDef<TemplateSummaryDto>[]>(
    () => [
      { field: "templateId", headerName: "ID", type: "number", maxWidth: 90, sortable: true, filter: false },
      { field: "objectType", headerName: "유형", type: "number", maxWidth: 90, sortable: true, filter: false },
      { field: "objectId", headerName: "식별자", type: "number", maxWidth: 100, sortable: true, filter: false },
      {
        field: "name",
        headerName: "이름",
        flex: 1.5,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<TemplateSummaryDto>) => (
          <Box
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/application/templates/${params.data?.templateId}`);
            }}
            sx={{
              border: 0,
              p: 0,
              bgcolor: "transparent",
              color: "primary.main",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {params.value}
          </Box>
        ),
      },
      { field: "displayName", headerName: "표시 이름", flex: 1.5, sortable: true, filter: false },
      {
        field: "createdBy",
        headerName: "생성자",
        flex: 0.75,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<TemplateSummaryDto>) => {
          const user = params.value as TemplateSummaryDto["createdBy"];
          return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
              <Avatar
                alt={user?.username ?? ""}
                src={
                  user
                    ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar`
                    : NO_AVATAR
                }
                imgProps={{
                  onError: (e) => { e.currentTarget.src = NO_AVATAR; },
                }}
                sx={{ width: 24, height: 24, bgcolor: "grey.200" }}
              />
              <Typography variant="body2" noWrap>
                {user ? user.username : "-"}
              </Typography>
            </Stack>
          );
        },
      },
      { field: "createdAt", headerName: "생성일시", type: "datetime", flex: 1, sortable: true, filter: false },
      {
        field: "updatedBy",
        headerName: "수정자",
        flex: 0.75,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<TemplateSummaryDto>) => {
          const user = params.value as TemplateSummaryDto["updatedBy"];
          return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
              <Avatar
                alt={user?.username ?? ""}
                src={
                  user
                    ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar`
                    : NO_AVATAR
                }
                imgProps={{
                  onError: (e) => { e.currentTarget.src = NO_AVATAR; },
                }}
                sx={{ width: 24, height: 24, bgcolor: "grey.200" }}
              />
              <Typography variant="body2" noWrap>
                {user ? user.username : "-"}
              </Typography>
            </Stack>
          );
        },
      },
      { field: "updatedAt", headerName: "수정일시", type: "datetime", flex: 1, sortable: true, filter: false },
    ],
    [navigate]
  );

  const gridOptions = useMemo(
    () => ({
      rowSelection: { mode: "multiRow" as const, enableClickSelection: false, checkboxes: true, headerCheckbox: false },
      suppressRowClickSelection: true,
      selectionColumnDef: {
        width: 65,
        minWidth: 65,
        maxWidth: 65,
        pinned: "left" as const,
        sortable: false,
        filter: false,
        resizable: false,
      },
      rowMultiSelectWithClick: true,
    }),
    []
  );

  const gridEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: unknown) => {
          const rows = (event as SelectionChangedEvent<TemplateSummaryDto>).api.getSelectedRows();
          setSelectedIds(
            rows
              .map((row) => Number(row.templateId))
              .filter((id) => Number.isFinite(id) && id > 0)
          );
        },
      },
    ],
    []
  );

  function applyFilters() {
    dataSource.applyFilter({
      ...(keyword.trim() ? { q: keyword.trim(), fields: "name,subject" } : {}),
      ...(objectType.trim() ? { objectType: Number(objectType) } : {}),
      ...(objectId.trim() ? { objectId: Number(objectId) } : {}),
    });
    gridRef.current?.refresh();
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: "삭제 확인",
      message: `선택한 ${selectedIds.length}개의 템플릿을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;

    try {
      await Promise.all(selectedIds.map((templateId) => reactTemplatesApi.delete(templateId)));
      toast.success("삭제 완료");
      gridRef.current?.deselectAll();
      setSelectedIds([]);
      gridRef.current?.refresh();
    } catch {
      toast.error("템플릿 삭제에 실패했습니다.");
    }
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["애플리케이션", "템플릿"]}
        label="템플릿을 조회하고 생성합니다."
        onRefresh={() => gridRef.current?.refresh()}
        searchPlaceholder="템플릿 검색"
        searchValue={keyword}
        onSearchValueChange={setKeyword}
        onSearch={applyFilters}
        actions={
          <>
            <Tooltip title="템플릿을 생성합니다.">
              <IconButton size="small" onClick={() => setCreateOpen(true)}>
                <AddOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={selectedCount > 0 ? "선택 삭제" : "삭제할 템플릿을 선택하세요"}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={selectedCount === 0}
                  onClick={() => void handleDeleteSelected()}
                >
                  <DeleteOutlineOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ py: 0.5 }}>
        <TextField
          label="객체 유형"
          value={objectType}
          onChange={(event) => setObjectType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyFilters();
          }}
          size="small"
          select
          sx={{ minWidth: 240 }}
          SelectProps={{
            renderValue: (selected) => {
              const selectedType = objectTypes.find(
                (item) => String(item.objectType) === String(selected)
              );
              return selectedType
                ? `${selectedType.code} #${selectedType.objectType}`
                : "선택";
            },
          }}
        >
          <MenuItem value="">선택</MenuItem>
          {objectTypes.map((item) => (
            <MenuItem key={item.objectType} value={String(item.objectType)}>
              <Stack spacing={0}>
                <Typography variant="body2">
                  {item.code} #{item.objectType}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.name}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="객체 식별자"
          type="number"
          value={objectId}
          onChange={(event) => setObjectId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applyFilters();
          }}
          size="small"
        />
      </Stack>
      <PageableGridContent<TemplateSummaryDto>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
        options={gridOptions}
        events={gridEvents}
      />
      <CreateTemplateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => gridRef.current?.refresh()}
      />
    </Stack>
  );
}

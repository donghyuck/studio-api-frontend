import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, RefreshOutlined } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { useConfirm, useToast } from "@/react/feedback";
import type {
  AclClassDto,
  AclEntryDto,
  AclObjectIdentityDto,
  AclSidDto,
} from "@/types/studio/acl";
import type { AclActionMaskDto } from "@/types/studio/ai";
import { aclQueryKeys } from "./queryKeys";
import { reactAclApi } from "./api";
import {
  AclClassesDataSource,
  AclEntriesDataSource,
  AclObjectsDataSource,
  AclSidsDataSource,
} from "./datasource";
import { CreateClassDialog } from "./CreateClassDialog";
import { CreateSidDialog } from "./CreateSidDialog";
import { CreateObjectDialog } from "./CreateObjectDialog";
import { CreateEntryDialog } from "./CreateEntryDialog";
import { PageToolbar } from "@/react/components/page/PageToolbar";

function SectionHeader({
  title,
  onAdd,
  onRefresh,
}: {
  title: string;
  onAdd: () => void;
  onRefresh: () => void;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="subtitle1">{title}</Typography>
      <Stack direction="row" spacing={1}>
        <Tooltip title="추가">
          <IconButton size="small" onClick={onAdd}>
            <AddOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="새로고침">
          <IconButton size="small" onClick={onRefresh}>
            <RefreshOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export function AclPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const classesGridRef = useRef<PageableGridContentHandle<AclClassDto>>(null);
  const sidsGridRef = useRef<PageableGridContentHandle<AclSidDto>>(null);
  const objectsGridRef = useRef<PageableGridContentHandle<AclObjectIdentityDto>>(null);
  const entriesGridRef = useRef<PageableGridContentHandle<AclEntryDto>>(null);
  const classesSectionRef = useRef<HTMLDivElement | null>(null);
  const sidsSectionRef = useRef<HTMLDivElement | null>(null);
  const objectsSectionRef = useRef<HTMLDivElement | null>(null);
  const entriesSectionRef = useRef<HTMLDivElement | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("classes");

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [createSidOpen, setCreateSidOpen] = useState(false);
  const [createObjectOpen, setCreateObjectOpen] = useState(false);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);

  const classesDataSource = useMemo(() => new AclClassesDataSource(), []);
  const sidsDataSource = useMemo(() => new AclSidsDataSource(), []);
  const objectsDataSource = useMemo(() => new AclObjectsDataSource(), []);
  const entriesDataSource = useMemo(() => new AclEntriesDataSource(), []);

  const classesQuery = useQuery({
    queryKey: aclQueryKeys.custom("classes"),
    queryFn: reactAclApi.listClasses,
  });
  const sidsQuery = useQuery({
    queryKey: aclQueryKeys.custom("sids"),
    queryFn: reactAclApi.listSids,
  });
  const objectsQuery = useQuery({
    queryKey: aclQueryKeys.custom("objects"),
    queryFn: reactAclApi.listObjects,
  });
  const actionsQuery = useQuery({
    queryKey: aclQueryKeys.custom("actions"),
    queryFn: reactAclApi.listActions,
  });

  const classes = classesQuery.data ?? [];
  const sids = sidsQuery.data ?? [];
  const objects = objectsQuery.data ?? [];
  const actions = actionsQuery.data ?? [];

  const objectById = useMemo(
    () => Object.fromEntries(objects.map((objectIdentity) => [objectIdentity.id, objectIdentity])),
    [objects]
  );
  const actionByMask = useMemo(
    () => Object.fromEntries(actions.map((action) => [action.mask, action.action])),
    [actions]
  );
  const sidById = useMemo(
    () => Object.fromEntries(sids.map((sid) => [sid.id, sid])),
    [sids]
  );

  const refreshLookups = useCallback(async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: aclQueryKeys.custom("classes") }),
        queryClient.invalidateQueries({ queryKey: aclQueryKeys.custom("sids") }),
        queryClient.invalidateQueries({ queryKey: aclQueryKeys.custom("objects") }),
        queryClient.invalidateQueries({ queryKey: aclQueryKeys.custom("actions") }),
      ]);
      setPageError(null);
    } catch {
      setPageError("ACL lookup 데이터를 새로고침하지 못했습니다.");
      toast.error("ACL lookup 데이터를 새로고침하지 못했습니다.");
    }
  }, [queryClient, toast]);

  const refreshAllGrids = useCallback(async () => {
    classesGridRef.current?.refresh();
    sidsGridRef.current?.refresh();
    objectsGridRef.current?.refresh();
    entriesGridRef.current?.refresh();
    await refreshLookups();
  }, [refreshLookups]);

  const classesColumnDefs = useMemo<ColDef<AclClassDto>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5, filter: false },
      { field: "className", headerName: "클래스명", sortable: true, flex: 1.5, filter: false },
      { field: "classIdType", headerName: "ID 타입", sortable: true, flex: 1, filter: false },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        filter: false,
        flex: 0.5,
        cellRenderer: (params: { data?: AclClassDto }) => (
          <IconButton color="error" size="small" onClick={() => params.data && void handleDeleteClass(params.data.id)}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        ),
      },
    ],
    []
  );

  const sidsColumnDefs = useMemo<ColDef<AclSidDto>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5, filter: false },
      { field: "sid", headerName: "SID", sortable: true, flex: 1.5, filter: false },
      {
        colId: "principal",
        headerName: "유형",
        sortable: true,
        flex: 1,
        filter: false,
        cellRenderer: (params: { data?: AclSidDto }) => (
          <Chip size="small" label={params.data?.principal ? "Principal" : "Authority"} />
        ),
      },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        filter: false,
        flex: 0.5,
        cellRenderer: (params: { data?: AclSidDto }) => (
          <IconButton color="error" size="small" onClick={() => params.data && void handleDeleteSid(params.data.id)}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        ),
      },
    ],
    []
  );

  const objectsColumnDefs = useMemo<ColDef<AclObjectIdentityDto>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5, filter: false },
      { field: "className", headerName: "클래스", sortable: true, flex: 1, filter: false },
      {
        colId: "objectIdIdentity",
        headerName: "오브젝트 ID",
        sortable: true,
        flex: 1,
        filter: false,
        valueGetter: (params) =>
          String(params.data?.objectIdIdentity) === "__root__"
            ? "__root__"
            : String(params.data?.objectIdIdentity ?? ""),
      },
      {
        colId: "ownerSidId",
        headerName: "Owner SID",
        sortable: false,
        flex: 1,
        filter: false,
        valueGetter: (params) => {
          const ownerSidId = params.data?.ownerSidId;
          return ownerSidId ? sidById[ownerSidId]?.sid ?? ownerSidId : "-";
        },
      },
      {
        colId: "entriesInheriting",
        headerName: "상속",
        sortable: true,
        flex: 0.7,
        filter: false,
        cellRenderer: (params: { data?: AclObjectIdentityDto }) => (
          <Chip size="small" label={params.data?.entriesInheriting ? "상속" : "비상속"} />
        ),
      },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        filter: false,
        flex: 0.5,
        cellRenderer: (params: { data?: AclObjectIdentityDto }) => (
          <IconButton color="error" size="small" onClick={() => params.data && void handleDeleteObject(params.data.id)}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [sidById]
  );

  const entriesColumnDefs = useMemo<ColDef<AclEntryDto>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5, filter: false },
      {
        colId: "object",
        headerName: "오브젝트",
        sortable: false,
        flex: 1.5,
        filter: false,
        valueGetter: (params) => {
          const objectIdentity = objectById[params.data?.aclObjectIdentity ?? -1];
          return objectIdentity
            ? `${objectIdentity.className}#${String(objectIdentity.objectIdIdentity)}`
            : params.data?.aclObjectIdentity;
        },
      },
      {
        colId: "sid",
        headerName: "SID",
        sortable: false,
        flex: 1,
        filter: false,
        valueGetter: (params) => sidById[params.data?.sid ?? -1]?.sid ?? params.data?.sid,
      },
      {
        colId: "mask",
        headerName: "액션",
        sortable: false,
        flex: 1,
        filter: false,
        valueGetter: (params) => actionByMask[params.data?.mask ?? -1] ?? params.data?.mask,
      },
      { field: "aceOrder", headerName: "순서", sortable: true, flex: 0.6, filter: false },
      {
        colId: "granting",
        headerName: "허용 여부",
        sortable: true,
        flex: 0.8,
        filter: false,
        cellRenderer: (params: { data?: AclEntryDto }) => (
          <Chip
            size="small"
            color={params.data?.granting ? "success" : "error"}
            label={params.data?.granting ? "허용" : "거부"}
          />
        ),
      },
      {
        colId: "audit",
        headerName: "감사",
        sortable: false,
        flex: 1,
        filter: false,
        cellRenderer: (params: { data?: AclEntryDto }) => (
          <Stack direction="row" spacing={0.5}>
            {params.data?.auditSuccess ? <Chip size="small" label="성공" /> : null}
            {params.data?.auditFailure ? <Chip size="small" label="실패" /> : null}
            {!params.data?.auditSuccess && !params.data?.auditFailure ? (
              <Typography color="text.secondary">-</Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        colId: "actions",
        headerName: "",
        sortable: false,
        filter: false,
        flex: 0.5,
        cellRenderer: (params: { data?: AclEntryDto }) => (
          <IconButton color="error" size="small" onClick={() => params.data && void handleDeleteEntry(params.data.id)}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [actionByMask, objectById, sidById]
  );

  async function handleDeleteClass(id: number) {
    const ok = await confirm({ title: "ACL 클래스 삭제", message: "이 클래스를 삭제하시겠습니까?" });
    if (!ok) return;

    try {
      await reactAclApi.deleteClass(id);
      toast.success("ACL 클래스가 삭제되었습니다.");
      classesGridRef.current?.refresh();
      await refreshLookups();
    } catch {
      toast.error("ACL 클래스 삭제에 실패했습니다.");
    }
  }

  async function handleDeleteSid(id: number) {
    const ok = await confirm({ title: "ACL SID 삭제", message: "이 SID를 삭제하시겠습니까?" });
    if (!ok) return;

    try {
      await reactAclApi.deleteSid(id);
      toast.success("ACL SID가 삭제되었습니다.");
      sidsGridRef.current?.refresh();
      objectsGridRef.current?.refresh();
      entriesGridRef.current?.refresh();
      await refreshLookups();
    } catch {
      toast.error("ACL SID 삭제에 실패했습니다.");
    }
  }

  async function handleDeleteObject(id: number) {
    const ok = await confirm({
      title: "ACL 오브젝트 삭제",
      message: "이 오브젝트 아이덴티티를 삭제하시겠습니까?",
    });
    if (!ok) return;

    try {
      await reactAclApi.deleteObject(id);
      toast.success("ACL 오브젝트가 삭제되었습니다.");
      objectsGridRef.current?.refresh();
      entriesGridRef.current?.refresh();
      await refreshLookups();
    } catch {
      toast.error("ACL 오브젝트 삭제에 실패했습니다.");
    }
  }

  async function handleDeleteEntry(id: number) {
    const ok = await confirm({ title: "ACL 엔트리 삭제", message: "이 ACL 엔트리를 삭제하시겠습니까?" });
    if (!ok) return;

    try {
      await reactAclApi.deleteEntry(id);
      toast.success("ACL 엔트리가 삭제되었습니다.");
      entriesGridRef.current?.refresh();
    } catch {
      toast.error("ACL 엔트리 삭제에 실패했습니다.");
    }
  }

  function handleSectionChange(section: string) {
    setActiveSection(section);
    const target = {
      classes: classesSectionRef,
      sids: sidsSectionRef,
      objects: objectsSectionRef,
      entries: entriesSectionRef,
    }[section]?.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Stack spacing={1}>
      <PageToolbar
        divider={false}
        breadcrumbs={["시스템관리", "보안관리", "ACL 관리"]}
        label="클래스, SID, 오브젝트 아이덴티티, 엔트리를 한 화면에서 관리합니다."
        onRefresh={() => void refreshAllGrids()}
      />

      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1080px) 180px" }, gap: 2 }}>
        <Stack spacing={1} sx={{ maxWidth: 1080, width: "100%" }}>
          <Paper ref={classesSectionRef} elevation={0} sx={{ p: 0, scrollMarginTop: 56 }}>
            <Stack spacing={1}>
              <SectionHeader
                title="ACL 클래스"
                onAdd={() => setCreateClassOpen(true)}
                onRefresh={() => {
                  classesGridRef.current?.refresh();
                  void refreshLookups();
                }}
              />
              <PageableGridContent<AclClassDto>
                ref={classesGridRef}
                datasource={classesDataSource}
                columns={classesColumnDefs}
                height={500}
              />
            </Stack>
          </Paper>

          <Paper ref={sidsSectionRef} elevation={0} sx={{ p: 0, scrollMarginTop: 56 }}>
            <Stack spacing={1}>
              <SectionHeader
                title="ACL SID"
                onAdd={() => setCreateSidOpen(true)}
                onRefresh={() => {
                  sidsGridRef.current?.refresh();
                  void refreshLookups();
                }}
              />
              <PageableGridContent<AclSidDto>
                ref={sidsGridRef}
                datasource={sidsDataSource}
                columns={sidsColumnDefs}
                height={500}
              />
            </Stack>
          </Paper>

          <Paper ref={objectsSectionRef} elevation={0} sx={{ p: 0, scrollMarginTop: 56 }}>
            <Stack spacing={1}>
              <SectionHeader
                title="오브젝트 아이덴티티"
                onAdd={() => setCreateObjectOpen(true)}
                onRefresh={() => {
                  objectsGridRef.current?.refresh();
                  void refreshLookups();
                }}
              />
              <PageableGridContent<AclObjectIdentityDto>
                ref={objectsGridRef}
                datasource={objectsDataSource}
                columns={objectsColumnDefs}
                height={500}
              />
            </Stack>
          </Paper>

          <Paper ref={entriesSectionRef} elevation={0} sx={{ p: 0, scrollMarginTop: 56 }}>
            <Stack spacing={1}>
              <SectionHeader
                title="ACL 엔트리"
                onAdd={() => setCreateEntryOpen(true)}
                onRefresh={() => entriesGridRef.current?.refresh()}
              />
              <PageableGridContent<AclEntryDto>
                ref={entriesGridRef}
                datasource={entriesDataSource}
                columns={entriesColumnDefs}
                height={500}
              />
            </Stack>
          </Paper>
        </Stack>

        <Box
          component="aside"
          sx={{
            display: { xs: "none", lg: "block" },
            position: "sticky",
            top: 16,
            alignSelf: "start",
            borderLeft: "1px solid",
            borderColor: "divider",
            pl: 2,
            py: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            Contents
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "classes" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "classes" ? 700 : 400,
                borderLeft: activeSection === "classes" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "classes" ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={() => handleSectionChange("classes")}
            >
              ACL 클래스
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "sids" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "sids" ? 700 : 400,
                borderLeft: activeSection === "sids" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "sids" ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={() => handleSectionChange("sids")}
            >
              ACL SID
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "objects" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "objects" ? 700 : 400,
                borderLeft: activeSection === "objects" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "objects" ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={() => handleSectionChange("objects")}
            >
              오브젝트 아이덴티티
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{
                justifyContent: "flex-start",
                color: activeSection === "entries" ? "primary.main" : "text.secondary",
                fontWeight: activeSection === "entries" ? 700 : 400,
                borderLeft: activeSection === "entries" ? "2px solid" : "2px solid transparent",
                borderColor: activeSection === "entries" ? "primary.main" : "transparent",
                pl: 1,
              }}
              onClick={() => handleSectionChange("entries")}
            >
              ACL 엔트리
            </Button>
          </Stack>
        </Box>
      </Box>

      <CreateClassDialog
        open={createClassOpen}
        onClose={() => setCreateClassOpen(false)}
        onCreated={() => void refreshAllGrids()}
      />
      <CreateSidDialog
        open={createSidOpen}
        onClose={() => setCreateSidOpen(false)}
        onCreated={() => void refreshAllGrids()}
      />
      <CreateObjectDialog
        open={createObjectOpen}
        onClose={() => setCreateObjectOpen(false)}
        classes={classes}
        sids={sids}
        onCreated={() => void refreshAllGrids()}
      />
      <CreateEntryDialog
        open={createEntryOpen}
        onClose={() => setCreateEntryOpen(false)}
        classes={classes}
        sids={sids}
        objects={objects}
        actions={actions}
        onCreated={() => {
          entriesGridRef.current?.refresh();
        }}
      />
    </Stack>
  );
}

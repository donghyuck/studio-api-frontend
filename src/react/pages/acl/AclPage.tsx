import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, RefreshOutlined } from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import type {
  AclClassDto,
  AclEntryDto,
  AclObjectIdentityDto,
  AclSidDto,
} from "@/types/studio/acl";
import type { AclActionMaskDto } from "@/types/studio/ai";
import { reactAclApi } from "./api";
import { CreateClassDialog } from "./CreateClassDialog";
import { CreateSidDialog } from "./CreateSidDialog";
import { CreateObjectDialog } from "./CreateObjectDialog";
import { CreateEntryDialog } from "./CreateEntryDialog";

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
      <Typography variant="h6">{title}</Typography>
      <Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<AddOutlined />} onClick={onAdd}>
          추가
        </Button>
        <Button size="small" startIcon={<RefreshOutlined />} onClick={onRefresh}>
          새로고침
        </Button>
      </Stack>
    </Box>
  );
}

export function AclPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [classes, setClasses] = useState<AclClassDto[]>([]);
  const [sids, setSids] = useState<AclSidDto[]>([]);
  const [objects, setObjects] = useState<AclObjectIdentityDto[]>([]);
  const [entries, setEntries] = useState<AclEntryDto[]>([]);
  const [actions, setActions] = useState<AclActionMaskDto[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSids, setLoadingSids] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [createSidOpen, setCreateSidOpen] = useState(false);
  const [createObjectOpen, setCreateObjectOpen] = useState(false);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);

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

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      setClasses(await reactAclApi.listClasses());
      setPageError(null);
    } catch {
      setPageError("ACL 클래스를 불러오지 못했습니다.");
      toast.error("ACL 클래스를 불러오지 못했습니다.");
    } finally {
      setLoadingClasses(false);
    }
  }, [toast]);

  const loadSids = useCallback(async () => {
    setLoadingSids(true);
    try {
      setSids(await reactAclApi.listSids());
      setPageError(null);
    } catch {
      setPageError("ACL SID를 불러오지 못했습니다.");
      toast.error("ACL SID를 불러오지 못했습니다.");
    } finally {
      setLoadingSids(false);
    }
  }, [toast]);

  const loadObjects = useCallback(async () => {
    setLoadingObjects(true);
    try {
      setObjects(await reactAclApi.listObjects());
      setPageError(null);
    } catch {
      setPageError("ACL 오브젝트를 불러오지 못했습니다.");
      toast.error("ACL 오브젝트를 불러오지 못했습니다.");
    } finally {
      setLoadingObjects(false);
    }
  }, [toast]);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      setEntries(await reactAclApi.listEntries());
      setPageError(null);
    } catch {
      setPageError("ACL 엔트리를 불러오지 못했습니다.");
      toast.error("ACL 엔트리를 불러오지 못했습니다.");
    } finally {
      setLoadingEntries(false);
    }
  }, [toast]);

  const loadActions = useCallback(async () => {
    try {
      setActions(await reactAclApi.listActions());
    } catch {
      toast.error("ACL 액션 정의를 불러오지 못했습니다.");
    }
  }, [toast]);

  useEffect(() => {
    void loadClasses();
    void loadSids();
    void loadObjects();
    void loadEntries();
    void loadActions();
  }, [loadActions, loadClasses, loadEntries, loadObjects, loadSids]);

  async function handleDeleteClass(id: number) {
    const ok = await confirm({ title: "ACL 클래스 삭제", message: "이 클래스를 삭제하시겠습니까?" });
    if (!ok) return;

    try {
      await reactAclApi.deleteClass(id);
      toast.success("ACL 클래스가 삭제되었습니다.");
      await loadClasses();
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
      await loadSids();
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
      await loadObjects();
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
      await loadEntries();
    } catch {
      toast.error("ACL 엔트리 삭제에 실패했습니다.");
    }
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">시스템관리</Typography>
        <Typography color="text.secondary">보안관리</Typography>
        <Typography color="text.primary">ACL 관리</Typography>
      </Breadcrumbs>

      <Box>
        <Typography variant="h5">ACL 관리</Typography>
        <Typography variant="body2" color="text.secondary">
          클래스, SID, 오브젝트 아이덴티티, 엔트리를 한 화면에서 관리합니다.
        </Typography>
      </Box>

      {pageError ? <Alert severity="error">{pageError}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <SectionHeader
            title="ACL 클래스"
            onAdd={() => setCreateClassOpen(true)}
            onRefresh={() => void loadClasses()}
          />
          {loadingClasses ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>클래스명</TableCell>
                    <TableCell>ID 타입</TableCell>
                    <TableCell align="right">동작</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {classes.map((aclClass) => (
                    <TableRow key={aclClass.id}>
                      <TableCell>{aclClass.id}</TableCell>
                      <TableCell>{aclClass.className}</TableCell>
                      <TableCell>{aclClass.classIdType ?? "-"}</TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => void handleDeleteClass(aclClass.id)}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">등록된 ACL 클래스가 없습니다.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <SectionHeader title="ACL SID" onAdd={() => setCreateSidOpen(true)} onRefresh={() => void loadSids()} />
          {loadingSids ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>SID</TableCell>
                    <TableCell>유형</TableCell>
                    <TableCell align="right">동작</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sids.map((sid) => (
                    <TableRow key={sid.id}>
                      <TableCell>{sid.id}</TableCell>
                      <TableCell>{sid.sid}</TableCell>
                      <TableCell>
                        <Chip size="small" label={sid.principal ? "Principal" : "Authority"} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => void handleDeleteSid(sid.id)}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sids.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">등록된 SID가 없습니다.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <SectionHeader
            title="오브젝트 아이덴티티"
            onAdd={() => setCreateObjectOpen(true)}
            onRefresh={() => void loadObjects()}
          />
          {loadingObjects ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>클래스</TableCell>
                    <TableCell>오브젝트 ID</TableCell>
                    <TableCell>Owner SID</TableCell>
                    <TableCell>상속</TableCell>
                    <TableCell align="right">동작</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {objects.map((objectIdentity) => (
                    <TableRow key={objectIdentity.id}>
                      <TableCell>{objectIdentity.id}</TableCell>
                      <TableCell>{objectIdentity.className}</TableCell>
                      <TableCell>
                        {String(objectIdentity.objectIdIdentity) === "__root__"
                          ? "__root__"
                          : String(objectIdentity.objectIdIdentity)}
                      </TableCell>
                      <TableCell>{objectIdentity.ownerSidId ? sidById[objectIdentity.ownerSidId]?.sid ?? objectIdentity.ownerSidId : "-"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={objectIdentity.entriesInheriting ? "상속" : "비상속"} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => void handleDeleteObject(objectIdentity.id)}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {objects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">등록된 오브젝트 아이덴티티가 없습니다.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <SectionHeader
            title="ACL 엔트리"
            onAdd={() => setCreateEntryOpen(true)}
            onRefresh={() => void loadEntries()}
          />
          {loadingEntries ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>오브젝트</TableCell>
                    <TableCell>SID</TableCell>
                    <TableCell>액션</TableCell>
                    <TableCell>순서</TableCell>
                    <TableCell>허용 여부</TableCell>
                    <TableCell>감사</TableCell>
                    <TableCell align="right">동작</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => {
                    const objectIdentity = objectById[entry.aclObjectIdentity];
                    const sid = sidById[entry.sid];
                    const action = actionByMask[entry.mask] ?? entry.mask;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.id}</TableCell>
                        <TableCell>
                          {objectIdentity
                            ? `${objectIdentity.className}#${String(objectIdentity.objectIdIdentity)}`
                            : entry.aclObjectIdentity}
                        </TableCell>
                        <TableCell>{sid?.sid ?? entry.sid}</TableCell>
                        <TableCell>{String(action)}</TableCell>
                        <TableCell>{entry.aceOrder}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={entry.granting ? "success" : "error"}
                            label={entry.granting ? "허용" : "거부"}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            {entry.auditSuccess ? <Chip size="small" label="성공" /> : null}
                            {entry.auditFailure ? <Chip size="small" label="실패" /> : null}
                            {!entry.auditSuccess && !entry.auditFailure ? (
                              <Typography color="text.secondary">-</Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton color="error" size="small" onClick={() => void handleDeleteEntry(entry.id)}>
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography color="text.secondary">등록된 ACL 엔트리가 없습니다.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Divider />

      <CreateClassDialog
        open={createClassOpen}
        onClose={() => setCreateClassOpen(false)}
        onCreated={() => void loadClasses()}
      />
      <CreateSidDialog
        open={createSidOpen}
        onClose={() => setCreateSidOpen(false)}
        onCreated={() => void loadSids()}
      />
      <CreateObjectDialog
        open={createObjectOpen}
        onClose={() => setCreateObjectOpen(false)}
        classes={classes}
        sids={sids}
        onCreated={() => void loadObjects()}
      />
      <CreateEntryDialog
        open={createEntryOpen}
        onClose={() => setCreateEntryOpen(false)}
        classes={classes}
        sids={sids}
        objects={objects}
        actions={actions}
        onCreated={() => void loadEntries()}
      />
    </Stack>
  );
}

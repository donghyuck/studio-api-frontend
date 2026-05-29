import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { SearchOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { AttachmentDownloadUrlIssueLogsDataSource } from "@/react/pages/audit/AttachmentDownloadUrlIssueLogsDataSource";
import type { AttachmentDownloadUrlIssueLogEvent } from "@/react/pages/audit/attachmentDownloadUrlIssueLogsApi";

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(days: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
}

function startOfDayLocalToIso(dateStr: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayExclusiveLocalToIso(dateStr: string) {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildFilter({
  dateStart,
  dateEnd,
  attachmentId,
  objectType,
  objectId,
  principalName,
  endpointKind,
}: {
  dateStart: string;
  dateEnd: string;
  attachmentId: string;
  objectType: string;
  objectId: string;
  principalName: string;
  endpointKind: string;
}) {
  const filter: Record<string, string | number> = {};
  if (dateStart) {
    filter.from = startOfDayLocalToIso(dateStart);
  }
  if (dateEnd) {
    filter.to = endOfDayExclusiveLocalToIso(dateEnd);
  }
  if (attachmentId.trim()) {
    filter.attachmentId = Number(attachmentId);
  }
  if (objectType.trim()) {
    filter.objectType = Number(objectType);
  }
  if (objectId.trim()) {
    filter.objectId = Number(objectId);
  }
  if (principalName.trim()) {
    filter.issuedByPrincipalName = principalName.trim();
  }
  if (endpointKind) {
    filter.endpointKind = endpointKind;
  }
  return filter;
}

export function AttachmentDownloadUrlIssueLogPage() {
  const gridRef =
    useRef<PageableGridContentHandle<AttachmentDownloadUrlIssueLogEvent>>(null);
  const [searching, setSearching] = useState(false);
  const initialRange = useMemo(() => getPresetRange(7), []);
  const dataSource = useMemo(() => {
    const nextDataSource = new AttachmentDownloadUrlIssueLogsDataSource(
      setSearching,
    );
    nextDataSource.applyFilter(
      buildFilter({
        dateStart: initialRange.start,
        dateEnd: initialRange.end,
        attachmentId: "",
        objectType: "",
        objectId: "",
        principalName: "",
        endpointKind: "",
      }),
    );
    return nextDataSource;
  }, [initialRange.end, initialRange.start]);
  const [dateStart, setDateStart] = useState(initialRange.start);
  const [dateEnd, setDateEnd] = useState(initialRange.end);
  const [attachmentId, setAttachmentId] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [endpointKind, setEndpointKind] = useState("");

  const validRange = !dateStart || !dateEnd || dateStart <= dateEnd;

  const columnDefs = useMemo<ColDef<AttachmentDownloadUrlIssueLogEvent>[]>(
    () => [
      {
        field: "logId",
        headerName: "ID",
        width: 90,
        filter: false,
        sortable: true,
        type: "numericColumn",
      },
      {
        field: "attachmentId",
        headerName: "파일 ID",
        width: 110,
        filter: false,
        sortable: true,
        type: "numericColumn",
      },
      {
        field: "endpointKind",
        headerName: "구분",
        width: 100,
        filter: false,
        sortable: true,
      },
      {
        field: "issuedByPrincipalName",
        headerName: "발급자",
        flex: 0.9,
        minWidth: 140,
        filter: false,
        sortable: true,
      },
      {
        field: "issuedAt",
        headerName: "발급일시",
        flex: 1,
        minWidth: 180,
        filter: false,
        sortable: true,
        valueFormatter: (params) =>
          formatDateTime(params.value as string | undefined),
      },
      {
        field: "expiresAt",
        headerName: "만료일시",
        flex: 1,
        minWidth: 180,
        filter: false,
        sortable: true,
        valueFormatter: (params) =>
          formatDateTime(params.value as string | undefined),
      },
      {
        field: "ttlSeconds",
        headerName: "TTL",
        width: 90,
        filter: false,
        sortable: true,
        type: "numericColumn",
      },
      {
        field: "storageProviderId",
        headerName: "Provider",
        flex: 0.9,
        minWidth: 140,
        filter: false,
        sortable: true,
      },
      {
        field: "bucket",
        headerName: "Bucket",
        flex: 0.9,
        minWidth: 140,
        filter: false,
        sortable: true,
      },
      {
        field: "objectKeyHash",
        headerName: "Object Key Hash",
        flex: 1.4,
        minWidth: 220,
        filter: false,
        sortable: true,
      },
      {
        field: "clientIp",
        headerName: "IP",
        flex: 0.8,
        minWidth: 120,
        filter: false,
        sortable: true,
      },
      {
        field: "userAgent",
        headerName: "User-Agent",
        flex: 1.4,
        minWidth: 220,
        filter: false,
        sortable: false,
      },
    ],
    [],
  );

  function setPreset(days: number) {
    const range = getPresetRange(days);
    setDateStart(range.start);
    setDateEnd(range.end);
  }

  function handleSearch() {
    if (!validRange) {
      return;
    }
    dataSource.applyFilter(
      buildFilter({
        dateStart,
        dateEnd,
        attachmentId,
        objectType,
        objectId,
        principalName,
        endpointKind,
      }),
    );
    gridRef.current?.refresh();
  }

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        breadcrumbs={["시스템관리", "감사", "파일 다운로드 로그"]}
        label="첨부파일 Signed Download URL 발급 이력을 조회합니다."
        onRefresh={() => gridRef.current?.refresh()}
        divider={false}
      />

      <Stack spacing={1}>
        <Box
          sx={{
            border: 1,
            borderColor: "rgb(191 191 191)",
            borderRadius: 2,
            px: 1.5,
            py: 1.5,
          }}
        >
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="시작일(포함)"
                type="date"
                size="small"
                value={dateStart}
                onChange={(event) => setDateStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!validRange}
                fullWidth
              />
              <TextField
                label="종료일(포함)"
                type="date"
                size="small"
                value={dateEnd}
                onChange={(event) => setDateEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!validRange}
                helperText={
                  !validRange
                    ? "시작일이 종료일보다 늦을 수 없습니다."
                    : undefined
                }
                fullWidth
              />
              <TextField
                label="파일 ID"
                type="number"
                size="small"
                value={attachmentId}
                onChange={(event) => setAttachmentId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                fullWidth
              />
              <TextField
                label="객체 유형"
                type="number"
                size="small"
                value={objectType}
                onChange={(event) => setObjectType(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                fullWidth
              />
              <TextField
                label="객체 ID"
                type="number"
                size="small"
                value={objectId}
                onChange={(event) => setObjectId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                fullWidth
              />
              <TextField
                label="발급자"
                size="small"
                value={principalName}
                onChange={(event) => setPrincipalName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                fullWidth
              />
              <TextField
                label="발급 경로"
                size="small"
                value={endpointKind}
                onChange={(event) => setEndpointKind(event.target.value)}
                select
                fullWidth
              >
                <MenuItem value="">전체</MenuItem>
                <MenuItem value="MGMT">관리자</MenuItem>
                <MenuItem value="SERVICE">서비스</MenuItem>
              </TextField>
            </Stack>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1,
              }}
            >
              <ButtonGroup size="small" variant="text">
                <Button onClick={() => setPreset(1)}>오늘</Button>
                <Button onClick={() => setPreset(7)}>7일</Button>
                <Button onClick={() => setPreset(30)}>30일</Button>
              </ButtonGroup>
              <Button
                variant="outlined"
                startIcon={
                  searching ? (
                    <CircularProgress size={16} />
                  ) : (
                    <SearchOutlined />
                  )
                }
                onClick={handleSearch}
                disabled={!validRange || searching}
              >
                {searching ? "조회 중..." : "조회"}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Stack>

      <PageableGridContent<AttachmentDownloadUrlIssueLogEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}

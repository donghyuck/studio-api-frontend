import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";
import { RefreshOutlined, SearchOutlined } from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { LoginFailuresDataSource } from "@/react/pages/audit/LoginFailuresDataSource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function LoginFailureLogPage() {
  const gridRef = useRef<PageableGridContentHandle<LoginFailureEvent>>(null);
  const [searching, setSearching] = useState(false);
  const dataSource = useMemo(() => new LoginFailuresDataSource(setSearching), []);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [usernameLike, setUsernameLike] = useState("");

  const columnDefs = useMemo<ColDef<LoginFailureEvent>[]>(
    () => [
      { field: "id", headerName: "ID", sortable: true, flex: 0.5, filter: false },
      { field: "username", headerName: "사용자명", sortable: true, flex: 1, filter: false },
      { field: "remoteIp", headerName: "IP 주소", sortable: true, flex: 1, filter: false },
      { field: "failureType", headerName: "예외 유형", sortable: true, flex: 1.25, filter: false },
      { field: "message", headerName: "메시지", sortable: true, flex: 1.75, filter: false },
      { field: "userAgent", headerName: "User-Agent", sortable: true, flex: 2.5, filter: false },
      {
        field: "occurredAt",
        headerName: "시각",
        sortable: true,
        flex: 1.5,
        filter: false,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : "",
      },
    ],
    []
  );

  const handleRefresh = () => {
    gridRef.current?.refresh();
  };

  function setPreset(days: number) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setDateStart(start.toISOString().slice(0, 10));
    setDateEnd(end.toISOString().slice(0, 10));
  }

  function setToday() {
    setPreset(1);
  }

  function set7days() {
    setPreset(7);
  }

  function set30days() {
    setPreset(30);
  }

  function set6Months() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setDateStart(start.toISOString().slice(0, 10));
    setDateEnd(end.toISOString().slice(0, 10));
  }

  function setThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateStart(start.toISOString().slice(0, 10));
    setDateEnd(end.toISOString().slice(0, 10));
  }

  function startOfDayLocalToIso(dateStr: string) {
    const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  }

  function endOfDayExclusiveLocalToIso(dateStr: string) {
    const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
  }

  const validRange = !dateStart || !dateEnd || dateStart <= dateEnd;

  const handleSearch = () => {
    if (!validRange) {
      return;
    }

    const filter: Record<string, string> = {};
    if (dateStart) {
      filter.from = startOfDayLocalToIso(dateStart);
    }
    if (dateEnd) {
      filter.to = endOfDayExclusiveLocalToIso(dateEnd);
    }
    if (usernameLike.trim()) {
      filter.usernameLike = usernameLike.trim();
    }
    dataSource.applyFilter(filter);
    gridRef.current?.refresh();
  };

  useEffect(() => {
    setPreset(7);
  }, []);

  return (
    <Stack spacing={0.5}>
      <PageToolbar
        breadcrumbs={["시스템관리", "감사", "로그인 실패"]}
        label="로그인 실패 이력을 기간과 아이디 조건으로 조회합니다."
        onRefresh={handleRefresh}
        divider={false}
      />

      <Stack spacing={1}>
        <Box
          sx={{
            border: 1,
            borderColor: "rgba(148, 163, 184, 0.45)",
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
                helperText={!validRange ? "시작일이 종료일보다 늦을 수 없습니다." : undefined}
                fullWidth
              />
              <TextField
                label="아이디"
                size="small"
                value={usernameLike}
                onChange={(event) => setUsernameLike(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                fullWidth
              />
            </Stack>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              <ButtonGroup size="small" variant="text">
                <Button onClick={setToday}>오늘</Button>
                <Button onClick={set7days}>7일</Button>
                <Button onClick={set30days}>30일</Button>
                <Button onClick={set6Months}>6개월</Button>
                <Button onClick={setThisMonth}>이번달</Button>
              </ButtonGroup>
              <Button
                variant="outlined"
                startIcon={searching ? <CircularProgress size={16} /> : <SearchOutlined />}
                onClick={handleSearch}
                disabled={!validRange || searching}
              >
                {searching ? "조회 중..." : "조회"}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Stack>

      <PageableGridContent<LoginFailureEvent>
        ref={gridRef}
        datasource={dataSource}
        columns={columnDefs}
      />
    </Stack>
  );
}

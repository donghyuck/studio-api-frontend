import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DescriptionOutlined, ExpandMoreOutlined, FolderOutlined } from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { objectStorageQueryKeys } from "@/react/pages/objectstorage/queryKeys";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import { ObjectDialog } from "@/react/pages/objectstorage/ObjectDialog";
import type { BucketDto, ObjectListItemDto } from "@/types/studio/storage";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function ObjectStoragePage() {
  const { providerId = "" } = useParams();
  const [bucket, setBucket] = useState<BucketDto | null>(null);
  const [prefix, setPrefix] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ObjectListItemDto[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();

  const bucketsQuery = useQuery({
    queryKey: objectStorageQueryKeys.custom("buckets", providerId),
    queryFn: () => reactObjectStorageApi.fetchBuckets({ providerId }),
    enabled: Boolean(providerId),
  });

  const objectsQuery = useQuery({
    queryKey: objectStorageQueryKeys.custom("objects", providerId, bucket?.bucket ?? "", prefix),
    queryFn: () =>
      reactObjectStorageApi.fetchObjects({
        providerId,
        bucket: bucket?.bucket ?? "",
        prefix: prefix || undefined,
    }),
    enabled: Boolean(providerId) && Boolean(bucket?.bucket),
  });

  useEffect(() => {
    if (!objectsQuery.data) {
      setRows([]);
      setNextToken(null);
      setHasMore(false);
      return;
    }

    const filteredRows = reactObjectStorageApi
      .toRows(objectsQuery.data, true)
      .filter((item) => {
        if (!prefix) return true;
        const slash = prefix.endsWith("/") ? prefix : `${prefix}/`;
        const noSlash = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
        return item.key !== slash && item.key !== noSlash;
      });

    setRows(filteredRows);
    setNextToken(objectsQuery.data.nextToken ?? null);
    setHasMore(
      reactObjectStorageApi.hasMore(objectsQuery.data.truncated, objectsQuery.data.nextToken)
    );
  }, [objectsQuery.data, prefix]);

  const bucketColumns = useMemo<ColDef<BucketDto>[]>(
    () => [
      {
        field: "bucket",
        headerName: "버킷",
        flex: 1,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<BucketDto>) => (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setBucket(params.data ?? null);
              setPrefix("");
            }}
          >
            {params.value}
          </Button>
        ),
      },
      {
        field: "objectStorageType",
        headerName: "유형",
        flex: 0.45,
        sortable: true,
        filter: false,
      },
      {
        field: "createdDate",
        headerName: "생성일",
        flex: 0.45,
        sortable: true,
        filter: false,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
    ],
    []
  );

  const objectColumns = useMemo<ColDef<ObjectListItemDto>[]>(
    () => [
      {
        field: "key",
        headerName: "이름",
        flex: 1.2,
        sortable: true,
        filter: false,
        cellRenderer: (params: ICellRendererParams<ObjectListItemDto>) => (
          <Button
            variant="text"
            size="small"
            startIcon={
              params.data?.folder ? (
                <FolderOutlined fontSize="small" />
              ) : (
                <DescriptionOutlined fontSize="small" />
              )
            }
            onClick={() => {
              const row = params.data;
              if (!row) return;
              if (row.folder) {
                setPrefix(row.key);
                return;
              }
              setSelectedKey(row.key);
            }}
          >
            {prefix ? params.value?.replace(prefix, "") : params.value}
          </Button>
        ),
      },
      {
        field: "size",
        headerName: "크기",
        flex: 0.4,
        sortable: true,
        filter: false,
        valueFormatter: (params) => formatBytes(params.value),
      },
      {
        field: "lastModified",
        headerName: "수정일",
        flex: 0.5,
        sortable: true,
        filter: false,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
    ],
    [prefix]
  );

  function formatBytes(value?: number | null) {
    if (value == null) {
      return "";
    }

    if (value === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / 1024 ** index;

    return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
  }

  const breadcrumbs = reactObjectStorageApi.buildBreadcrumb(prefix, {
    rootLabel: bucket?.bucket ?? "root",
    rootDisabled: false,
  });

  function handleRefresh() {
    void bucketsQuery.refetch();
    if (bucket) {
      void objectsQuery.refetch();
    }
  }

  async function handleLoadMore() {
    if (!bucket || !nextToken || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = await reactObjectStorageApi.fetchObjects({
        providerId,
        bucket: bucket.bucket,
        prefix: prefix || undefined,
        token: nextToken,
      });

      const appendedRows = reactObjectStorageApi.toRows(response, true).filter((item) => {
        if (!prefix) return true;
        const slash = prefix.endsWith("/") ? prefix : `${prefix}/`;
        const noSlash = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
        return item.key !== slash && item.key !== noSlash;
      });

      setRows((current) => {
        const seen = new Set(current.map((item) => item.key));
        const merged = [...current];
        for (const item of appendedRows) {
          if (!seen.has(item.key)) {
            merged.push(item);
            seen.add(item.key);
          }
        }
        return merged;
      });
      setNextToken(response.nextToken ?? null);
      setHasMore(reactObjectStorageApi.hasMore(response.truncated, response.nextToken));
    } catch (error) {
      console.error(error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <Stack spacing={0.5}>
        <PageToolbar
          breadcrumbs={["서비스 관리", "Object Storage", providerId]}
          label="Provider 기준 버킷과 오브젝트를 조회합니다."
          onRefresh={handleRefresh}
          divider={false}
          previous
          onPrevious={() => navigate("/services/object-storage")}
        />
        {bucketsQuery.isError ? <Alert severity="error">버킷 목록을 불러오지 못했습니다.</Alert> : null}
        <GridContent<BucketDto> columns={bucketColumns} rowData={bucketsQuery.data ?? []} height={280} />
        {bucket ? (
          <Stack spacing={0.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Breadcrumbs separator="›" sx={{ minWidth: 0, fontSize: 12 }}>
                {breadcrumbs.map((item, index) => {
                  const active = index === breadcrumbs.length - 1;

                  return active ? (
                    <Typography key={item.prefix} color="text.primary" fontSize={12} fontWeight={600}>
                      {item.label}
                    </Typography>
                  ) : (
                    <Link
                      key={item.prefix}
                      component="button"
                      type="button"
                      underline="hover"
                      color="text.secondary"
                      onClick={() => setPrefix(item.prefix)}
                      sx={{ cursor: "pointer", font: "inherit", fontSize: 12 }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </Breadcrumbs>
              <Tooltip title={hasMore ? "더 불러오기" : "더 불러올 항목이 없습니다"}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => void handleLoadMore()}
                    disabled={!hasMore || loadingMore}
                    sx={{ width: 34, height: 34 }}
                  >
                    <ExpandMoreOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            {objectsQuery.isError ? <Alert severity="error">오브젝트 목록을 불러오지 못했습니다.</Alert> : null}
            <GridContent<ObjectListItemDto> columns={objectColumns} rowData={rows} height={360} />
          </Stack>
        ) : null}
      </Stack>
      <ObjectDialog
        open={!!selectedKey}
        onClose={() => setSelectedKey(null)}
        bucket={bucket}
        objectKey={selectedKey ?? undefined}
      />
    </>
  );
}

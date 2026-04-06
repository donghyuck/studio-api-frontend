import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Box, Breadcrumbs, Button, Chip, Stack, Typography } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { objectStorageQueryKeys } from "@/react/pages/objectstorage/queryKeys";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import { ObjectDialog } from "@/react/pages/objectstorage/ObjectDialog";
import type { BucketDto, ObjectListItemDto } from "@/types/studio/storage";
import { resolveAxiosError } from "@/utils/helpers";

export function ObjectStoragePage() {
  const { providerId = "" } = useParams();
  const [bucket, setBucket] = useState<BucketDto | null>(null);
  const [prefix, setPrefix] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ObjectListItemDto[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
      { field: "objectStorageType", headerName: "유형", flex: 0.45, sortable: true },
      {
        field: "createdDate",
        headerName: "생성일",
        flex: 0.45,
        sortable: true,
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
        cellRenderer: (params: ICellRendererParams<ObjectListItemDto>) => (
          <Button
            variant="text"
            size="small"
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
      { field: "size", headerName: "크기", flex: 0.4, sortable: true },
      {
        field: "lastModified",
        headerName: "수정일",
        flex: 0.5,
        sortable: true,
        valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString() : ""),
      },
      {
        field: "folder",
        headerName: "종류",
        flex: 0.3,
        valueFormatter: (params) => (params.value ? "폴더" : "파일"),
      },
    ],
    [prefix]
  );

  const breadcrumbs = reactObjectStorageApi.buildBreadcrumb(prefix, {
    rootLabel: bucket?.bucket ?? "root",
    rootDisabled: false,
  });

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
      <Stack spacing={2}>
        <Breadcrumbs separator="›">
          <Typography color="text.secondary">서비스 관리</Typography>
          <Typography color="text.secondary">Object Storage</Typography>
          <Typography color="text.primary">{providerId}</Typography>
        </Breadcrumbs>

        <Typography variant="h5">Buckets</Typography>
        {bucketsQuery.isError ? <Alert severity="error">버킷 목록을 불러오지 못했습니다.</Alert> : null}
        <GridContent<BucketDto> columns={bucketColumns} rowData={bucketsQuery.data ?? []} height={280} />

        {bucket ? (
          <Stack spacing={2}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {breadcrumbs.map((item) => (
                  <Chip
                    key={item.prefix}
                    label={item.label}
                    onClick={item.disabled ? undefined : () => setPrefix(item.prefix)}
                    variant={item.disabled ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
              {hasMore ? (
                <Button
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  더 불러오기
                </Button>
              ) : null}
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

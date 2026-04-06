import {
  buildBreadcrumb,
  downloadFile,
  fetchBuckets,
  fetchObjectHead,
  fetchObjects,
  fetchProviders,
  hasMore,
  openInNewTab,
  presignGet,
  toRows,
} from "@/data/studio/mgmt/storage";

export const reactObjectStorageApi = {
  fetchProviders,
  fetchBuckets,
  fetchObjects,
  fetchObjectHead,
  presignGet,
  buildBreadcrumb,
  toRows,
  hasMore,
  downloadFile,
  openInNewTab,
};

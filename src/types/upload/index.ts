 interface UploadMeta {
  module: string;
  refId: string;
  tag?: string;
}

 interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

 interface UploadResult {
  id: number;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
  module: string;
  refId: string;
  tag: string;
  uploadedByName: string | null;
}

export type { UploadResult, UploadOptions, UploadMeta };
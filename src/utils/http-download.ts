import type { AxiosResponse } from "axios";
import { parseFilenameFromContentDisposition, saveBlob } from "./download";

export function handleBlobDownloadResponse(
  res: AxiosResponse<Blob>,
  fallbackName = "download.bin",
  autoSave = true
): Blob {
  const blob = res.data;
  if (autoSave) {
    const cd = res.headers?.["content-disposition"];
    const name = parseFilenameFromContentDisposition(cd) ?? fallbackName;
    saveBlob(blob, name);
  }
  return blob;
}

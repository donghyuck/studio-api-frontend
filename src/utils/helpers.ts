import type { Property } from "@/types/studio";
import axios from "axios";

const IN_BROWSER = typeof window !== "undefined";
const HTTP = "http";
const API_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

const DEFAULT_DOWNLOAD_OPTIONS = {
  thumbnail: false,
  width: 150,
  height: 150,
  timestamp: false,
};

export function getMatchMedia() {
  if (!IN_BROWSER) return;
  return window.matchMedia("(prefers-color-scheme: light)");
}
export { DEFAULT_DOWNLOAD_OPTIONS, IN_BROWSER, API_HEADERS };

/**
 *
 * @returns length of window history
 */
export function hasHistory() {
  return window.history.length > 2;
}

export function isAdultOnly(item: { properties: { audltOnly: boolean } }) {
  if (
    item.hasOwnProperty("properties") &&
    item.properties.hasOwnProperty("adultOnly")
  ) {
    return item.properties.hasOwnProperty("adultOnly");
  }
  return false;
}

export function isSharedImage(image: any) {
  if (
    image != null &&
    typeof image.imageLink != "undefined" &&
    image.imageLink != null
  ) {
    return true;
  } else {
    return false;
  }
}

const REG_EX_FOR_VIDEO = /^video/i;

const REG_EX_FOR_AUDIO = /^audio/i;

const REG_EX_FOR_IMAGE = /^image/i;

const REG_EX_FOR_PDF = /pdf$/i;

const REG_EX_FOR_EXT = /\.[0-9a-z]+$/i;

export function isVideoOrAudioOrImgOrPdf(contentType: string) {
  if (
    REG_EX_FOR_VIDEO.test(contentType) ||
    REG_EX_FOR_AUDIO.test(contentType) ||
    REG_EX_FOR_IMAGE.test(contentType) ||
    REG_EX_FOR_PDF.test(contentType)
  )
    return true;
  return false;
}

function getExtenstion(filename: string) {
  let ext = filename.match(REG_EX_FOR_EXT);
  ext = ext || [""];
  return ext[0].toLowerCase();
}

export function stringToArray(tags: string) {
  if (tags === null) return [];
  return tags.split(" ").map((value) => {
    return value;
  });
}

export function stringToArrayByComma(
  raw?: string | null,
  opts?: { dedupe?: boolean }
): string[] {
  const arr = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return opts?.dedupe ? [...new Set(arr)] : arr;
}

export function toTags(tags: string) {
  if (tags === null) return [];
  return tags.split(" ").map((value) => {
    return {
      text: value,
      color: "primary",
    };
  });
}

export function camelToSnakeCase(str: string) {
  if (str === null) return str;
  else {
    return (
      str[0].toLowerCase() +
      str
        .slice(1, str.length)
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    );
  }
}

export function toUnderscoreCase(str: string) {
  if (str === null) return str;
  return str
    .split(/\.?(?=[A-Z])/)
    .join("_")
    .toUpperCase();
}

export const uri_encoding = (str: string) => {
  return encodeURI(str);
};
////////////////////
// AG-GRIID UTILS
export const convertAgGridFilterToKendo = (agFilterModel: any) => {
  const kendoFilters = Object.keys(agFilterModel).map((colId) => {
    const filter = agFilterModel[colId];
    let operator;
    switch (filter.filterType) {
      case "text":
        operator = convertNumberFilterType(filter.type);
        break;
      case "number":
        operator = convertNumberFilterType(filter.type);
        break;
      case "boolean":
        operator = "eq";
        break;
      case "date":
        operator = convertNumberFilterType(filter.type);
        break;
      default:
        operator = "eq";
    }
    return {
      field: colId,
      operator: operator,
      value: filter.filter,
    };
  });

  return {
    logic: "and",
    filters: kendoFilters,
  };
};

// 숫자 필터 타입 변환 함수
const convertNumberFilterType = (type: string) => {
  switch (type) {
    case "equals":
      return "eq";
    case "notEqual":
      return "ne";
    case "lessThan":
      return "lt";
    case "lessThanOrEqual":
      return "lte";
    case "greaterThan":
      return "gt";
    case "greaterThanOrEqual":
      return "gte";
    case "contains":
      return "contains";
    default:
      return "eq";
  }
};

// ag-Grid 정렬 모델 변환 함수
export const convertAgGridSortToKendo = (agSortModel: any) => {
  return agSortModel.map((sortModel: any) => ({
    field: sortModel.colId,
    dir: sortModel.sort,
  }));
};

export const convertAgGridFilterToServerFormat: any = (agFilterModel: any) => {
  return Object.keys(agFilterModel).map((colId) => {
    const filter = agFilterModel[colId];
    let operator;
    switch (filter.filterType) {
      case "text":
        operator = "contains";
        break;
      case "number":
        operator = filter.type; // eq, ne, lt, lte, gt, gte
        break;
      case "boolean":
        operator = "eq";
        break;
      case "date":
        operator = filter.type; // eq, ne, lt, lte, gt, gte
        break;
      default:
        operator = "eq";
    }
    return {
      field: colId,
      filterType: filter.filterType,
      operator: operator,
      value: filter.filter,
      logic: filter.operator ? filter.operator : "and",
      filters:
        filter.condition1 && filter.condition2
          ? [
              convertAgGridFilterToServerFormat({
                [colId]: filter.condition1,
              })[0],
              convertAgGridFilterToServerFormat({
                [colId]: filter.condition2,
              })[0],
            ]
          : null,
    };
  });
};

export const formatDataSize = (params: any) => {
  const value = params.value;
  if (value === null || value === undefined) return "";
  if (value < 1024) return value + " B";
  else if (value < 1048576) return (value / 1024).toFixed(2) + " KB";
  else if (value < 1073741824) return (value / 1048576).toFixed(2) + " MB";
  else return (value / 1073741824).toFixed(2) + " GB";
};

// ApiResponse 래퍼를 쓰는 경우/안 쓰는 경우 모두 대응
function unwrapApi<T = any>(json: any): T {
  if (json && typeof json === "object") {
    if ("data" in json) return json.data as T; // { data, ... }
    if ("result" in json) return json.result as T;
  }
  return json as T;
}

export function toRowData(obj: Record<string, unknown>): Property[] {
  return Object.entries(obj).map(([name, value]) => ({ name, value }));
}

// 역변환 (rowData -> 객체)
export function fromRowData(rows: Property[]): Record<string, unknown> {
  return Object.fromEntries(rows.map(({ name, value }) => [name, value]));
}

export function resolveAxiosError(err: unknown): string {
  // 브라우저 오프라인
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "네트워크가 연결되지 않았습니다. 연결 확인 후 다시 시도해 주세요.";
  }

  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail as string | undefined;

    // 네트워크 계열 (CORS/서버다운/DNS 등, 응답 없음)
    if (!err.response || err.code === "ERR_NETWORK") {
      return (
        detail ?? "서버와 통신할 수 없습니다. 잠시 후에 다시 시도해 주세요."
      );
    }

    // 타임아웃
    if (err.code === "ECONNABORTED") {
      return (
        detail ??
        "요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해 주세요."
      );
    }

    // 서버가 응답한 경우: detail 우선, 없으면 상태코드 기준
    if (detail && detail.length > 0) {
      if (detail == "error.unexpected")
        return "알 수 없는 오류가 발생했습니다.";
      return detail;
    }

    switch (err.response.status) {
      case 400:
        return "잘못된 요청입니다.";
      case 401:
        return "아이디 또는 비밀번호를 확인해 주세요.";
      case 403:
        return "접근 권한이 없습니다.";
      case 404:
        return "요청하신 자원을 찾을 수 없습니다.";
      case 409:
        return "요청이 현재 서버 상태와 충돌합니다.";
      case 429:
        return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
      case 500:
        return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      case 502:
      case 503:
      case 504:
        return "서비스 이용이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
      default:
        return err.message || "알 수 없는 오류가 발생했습니다.";
    }
  }
  // AxiosError가 아닌 일반 오류
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const requiredAdminRoles: string[] = (
  import.meta.env.VITE_REQUIRED_ADMIN_ROLES ?? ""
)
  .split(",")
  .map((r: string) => r.trim())
  .filter(Boolean);

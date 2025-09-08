import { useAuthStore } from '@/stores/studio/auth.store';

const IN_BROWSER = typeof window !== 'undefined';
const HTTP = 'http';
const API_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const DEFAULT_DOWNLOAD_OPTIONS = {
  thumbnail: false,
  width: 150,
  height: 150,
  timestamp: false,
};

export function getMatchMedia() {
  if (!IN_BROWSER) return;
  return window.matchMedia('(prefers-color-scheme: light)');
}
export { DEFAULT_DOWNLOAD_OPTIONS, IN_BROWSER, API_HEADERS };

export function authHeader() {
  // return authorization header with jwt token
  const auth = useAuthStore();
  if (auth != null && auth.token) {
    return { Authorization: 'Bearer ' + auth.token };
  } else {
    return {};
  }
}

/**
 *
 * @returns length of window history
 */
export function hasHistory() {
  return window.history.length > 2;
}

export function isAdultOnly(item: { properties: { audltOnly: boolean } }) {
  if (
    item.hasOwnProperty('properties') &&
    item.properties.hasOwnProperty('adultOnly')
  ) {
    return item.properties.hasOwnProperty('adultOnly');
  }
  return false;
}

export function isSharedImage(image: any) {
  if (
    image != null &&
    typeof image.imageLink != 'undefined' &&
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

function getExtenstion(filename: string) {
  let ext = filename.match(REG_EX_FOR_EXT);
  ext = ext || [''];
  return ext[0].toLowerCase();
}

export function stringToArray(tags: string) {
  if (tags === null) return [];
  return tags.split(' ').map((value) => {
    return value;
  });
}

export function toTags(tags: string) {
  if (tags === null) return [];
  return tags.split(' ').map((value) => {
    return {
      text: value,
      color: 'primary',
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
    .join('_')
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
      case 'text':
        operator = convertNumberFilterType(filter.type);
        break;
      case 'number':
        operator = convertNumberFilterType(filter.type);
        break;
      case 'boolean':
        operator = 'eq';
        break;
      case 'date':
        operator = convertNumberFilterType(filter.type);
        break;
      default:
        operator = 'eq';
    }
    return {
      field: colId,
      operator: operator,
      value: filter.filter,
    };
  });

  return {
    logic: 'and',
    filters: kendoFilters,
  };
};

// 숫자 필터 타입 변환 함수
const convertNumberFilterType = (type: string) => {
  switch (type) {
    case 'equals':
      return 'eq';
    case 'notEqual':
      return 'ne';
    case 'lessThan':
      return 'lt';
    case 'lessThanOrEqual':
      return 'lte';
    case 'greaterThan':
      return 'gt';
    case 'greaterThanOrEqual':
      return 'gte';
    case 'contains':
      return 'contains';
    default:
      return 'eq';
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
      case 'text':
        operator = 'contains';
        break;
      case 'number':
        operator = filter.type; // eq, ne, lt, lte, gt, gte
        break;
      case 'boolean':
        operator = 'eq';
        break;
      case 'date':
        operator = filter.type; // eq, ne, lt, lte, gt, gte
        break;
      default:
        operator = 'eq';
    }
    return {
      field: colId,
      filterType: filter.filterType,
      operator: operator,
      value: filter.filter,
      logic: filter.operator ? filter.operator : 'and',
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

export const formatDataSize = (params:any) => {
  const value = params.value;
  if (value === null || value === undefined) return '';
  if (value < 1024) return value + ' B';
  else if (value < 1048576) return (value / 1024).toFixed(2) + ' KB';
  else if (value < 1073741824) return (value / 1048576).toFixed(2) + ' MB';
  else return (value / 1073741824).toFixed(2) + ' GB';
}
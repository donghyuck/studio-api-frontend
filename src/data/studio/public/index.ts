const envPageSize = Number(import.meta.env.VITE_GRID_PAGE_SIZE);

export const DEFAULT_PAGE_SIZE: number =
  !isNaN(envPageSize) && envPageSize > 0 ? envPageSize : 15;

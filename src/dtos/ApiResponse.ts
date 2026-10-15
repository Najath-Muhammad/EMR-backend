export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T;
  meta: ApiMeta;
}

export function successResponse<T>(
  message: string,
  data: T = null as unknown as T,
  meta: ApiMeta = {},
): ApiResponse<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(
  message: string,
  meta: ApiMeta = {},
): ApiResponse<null> {
  return { success: false, message, data: null, meta };
}

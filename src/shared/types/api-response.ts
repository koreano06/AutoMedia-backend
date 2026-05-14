export type ApiResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

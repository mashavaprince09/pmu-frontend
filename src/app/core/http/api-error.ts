export interface ApiError {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path?: string;
}

export function toApiError(err: unknown, fallbackStatus = 0): ApiError {
  if (err && typeof err === 'object' && 'error' in err) {
    const httpErr = err as { status?: number; error?: unknown };
    const body = httpErr.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return body as ApiError;
    }
  }
  return { status: fallbackStatus, error: 'Unknown', message: 'An unexpected error occurred.' };
}

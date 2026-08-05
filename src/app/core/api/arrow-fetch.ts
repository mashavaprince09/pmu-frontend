import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';

export class ArrowFetchError extends Error {
  constructor(public readonly apiError: ApiError) {
    super(apiError.message);
  }
}

/** Fetches an Arrow IPC stream with the bearer token, bypassing HttpClient so callers can pass an AbortSignal. */
export async function fetchArrowStream(
  path: string,
  token: string | null,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const res = await fetch(`${environment.apiBase}${path}`, {
    headers: {
      Accept: 'application/vnd.apache.arrow.stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    signal
  });

  if (!res.ok) {
    let apiError: ApiError = { status: res.status, error: res.statusText, message: `Request failed (${res.status})` };
    try {
      const body = await res.json();
      if (body && typeof body === 'object' && 'message' in body) {
        apiError = body as ApiError;
      }
    } catch {
      // body wasn't JSON; keep the default apiError
    }
    throw new ArrowFetchError(apiError);
  }

  return res.arrayBuffer();
}

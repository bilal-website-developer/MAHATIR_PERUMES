export interface ApiResponse<T = unknown> {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  } | null;
  meta: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  } | null;
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL =
  import.meta.env.PROD && configuredApiBaseUrl?.includes('localhost')
    ? ''
    : configuredApiBaseUrl ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Automatically attach auth token if available
  const token = localStorage.getItem('mahatir_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const responseText = await res.text();
    let json: ApiResponse<T>;
    try {
      json = JSON.parse(responseText) as ApiResponse<T>;
    } catch {
      return {
        data: null,
        error: {
          message: `API returned a non-JSON response (HTTP ${res.status}). Check the Vercel project root and API function deployment.`,
          code: 'INVALID_API_RESPONSE',
        },
        meta: null,
      };
    }

    if (!res.ok && !json.error) {
      return {
        ...json,
        error: { message: `API request failed (HTTP ${res.status}).`, code: 'HTTP_ERROR' },
      };
    }

    return json;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    return {
      data: null,
      error: { message, code: 'NETWORK_ERROR' },
      meta: null,
    };
  }
}

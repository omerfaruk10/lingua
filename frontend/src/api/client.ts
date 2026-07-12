// Tipli, minimal fetch sarmalayicisi. Base URL env ile ayarlanabilir.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8010'

export class ApiError extends Error {
  status: number
  code?: string
  detail?: unknown
  currentSession?: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
    if (detail && typeof detail === 'object') {
      const value = detail as { code?: string; current_session?: unknown }
      this.code = value.code
      this.currentSession = value.current_session
    }
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = res.statusText
    let rawDetail: unknown = detail
    try {
      const data = await res.json()
      if (data?.detail) {
        rawDetail = data.detail
        detail = typeof data.detail === 'string'
          ? data.detail
          : data.detail.message ?? JSON.stringify(data.detail)
      }
    } catch {
      // govde JSON degil; statusText yeterli
    }
    throw new ApiError(res.status, detail, rawDetail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export class ClientApiError extends Error {
  constructor(message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error;
    throw new ClientApiError(
      typeof error === "string" ? error : error?.message ?? "The request could not be completed.",
      error?.code,
      error?.details,
    );
  }
  return payload.data as T;
}

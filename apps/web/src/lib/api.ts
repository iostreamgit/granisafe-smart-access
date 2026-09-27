const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export type AuthUserDto = {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  roles: string[];
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserDto;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      detail?: string;
      message?: string;
      code?: string;
    };
    return new ApiError(
      response.status,
      body.detail ?? body.message ?? `Request failed (${response.status})`,
      body.code,
    );
  } catch {
    return new ApiError(response.status, `Request failed (${response.status})`);
  }
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AuthResponse>;
}

export async function refreshRequest(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AuthResponse>;
}

export async function logoutRequest(accessToken: string, refreshToken?: string) {
  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function meRequest(accessToken: string): Promise<AuthUserDto> {
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AuthUserDto>;
}

export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null;
  return response.json() as Promise<T>;
}

export async function apiDownload(
  path: string,
  accessToken: string,
  filename: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

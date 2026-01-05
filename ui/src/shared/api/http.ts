export const buildApiUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${trimmed}${suffix}`;
};

export const getJson = async <T>(path: string, baseUrl: string) => {
  const url = buildApiUrl(baseUrl, path);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export const postJson = async <T>(path: string, body: unknown, baseUrl: string) => {
  const url = buildApiUrl(baseUrl, path);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

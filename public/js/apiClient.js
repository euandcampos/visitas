const API_BASE = '/api';

let apiToken = localStorage.getItem('visitas_api_token') || '';

export function setApiToken(token) {
  apiToken = token || '';
  if (token) {
    localStorage.setItem('visitas_api_token', token);
  }
}

export function getApiToken() {
  return apiToken;
}

async function request(path, { method = 'GET', headers = {}, body, signal } = {}) {
  const url = `${API_BASE}${path}`;
  const finalHeaders = { ...headers };
  if (!(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (apiToken) {
    finalHeaders['Authorization'] = `Bearer ${apiToken}`;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    const error = new Error(`Erro HTTP ${response.status}: ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export function createVisit(payload = {}) {
  return request('/visits', { method: 'POST', body: payload });
}

export function getVisit(id) {
  return request(`/visits/${id}`);
}

export function listVisits(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/visits${query}`);
}

export function updateVisit(id, payload) {
  return request(`/visits/${id}`, { method: 'PATCH', body: payload });
}

export function deleteVisit(id) {
  return request(`/visits/${id}`, { method: 'DELETE' });
}

export async function uploadFiles(id, field, files) {
  const formData = new FormData();
  formData.append('field', field);
  files.forEach((file) => {
    formData.append('files', file, file.name);
  });

  const url = `${API_BASE}/visits/${id}/files`;
  const headers = {};
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    const error = new Error(`Erro ao enviar arquivos: ${errorText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function deleteFile(id, field, fileId) {
  const query = `?field=${encodeURIComponent(field)}`;
  return request(`/visits/${id}/files/${fileId}${query}`, { method: 'DELETE' });
}

export function getFileDownloadUrl(id, field, fileId) {
  const query = `?field=${encodeURIComponent(field)}`;
  return `${API_BASE}/visits/${id}/files/${fileId}${query}`;
}

export function submitVisit(id) {
  return request(`/visits/${id}/submit`, { method: 'POST' });
}


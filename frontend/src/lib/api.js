const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Shared fetch wrapper helper.
 * @param {string} endpoint - API path (e.g. '/decks')
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response JSON data
 */
export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('recall_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (response.status === 401) {
    // Unauthorized: clear storage and redirect to login
    localStorage.removeItem('recall_token');
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = '/login';
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Unauthorized');
  }

  if (response.status === 24) {
    // 204 No Content
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error! Status: ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint, options) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  delete: (endpoint, options) => apiFetch(endpoint, { ...options, method: 'DELETE' }),
};

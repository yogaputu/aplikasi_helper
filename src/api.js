import axios from 'axios';

const TOKEN_KEY = 'budimas_helper_token';
const USER_KEY = 'budimas_helper_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://58.147.185.142:9092',
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function unwrap(response) {
  return response?.data?.data ?? response?.data ?? {};
}

export async function loginDriver(payload) {
  const data = unwrap(await api.post('/api/helper-driver/login', payload));
  if (data?.token) {
    setToken(data.token);
    setStoredUser(data);
  }
  return data;
}

export async function getAssignments(params) {
  return unwrap(await api.get('/api/helper-driver/assignments', { params }));
}

export async function getAssignment(id) {
  return unwrap(await api.get(`/api/helper-driver/assignments/${id}`));
}

export async function updateStatus(id, payload) {
  return unwrap(await api.post(`/api/helper-driver/assignments/${id}/status`, payload));
}

export async function saveProof(id, payload) {
  return unwrap(await api.post(`/api/helper-driver/assignments/${id}/proof`, payload));
}

export async function saveTracking(payload) {
  return unwrap(await api.post('/api/helper-driver/tracking', payload));
}

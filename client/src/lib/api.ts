import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
export const WS_URL = import.meta.env.VITE_WS_URL;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  signup: (email: string, password: string, username: string) =>
    api.post('/auth', { action: 'signup', email, password, username }),
  confirmSignup: (email: string, code: string) =>
    api.post('/auth', { action: 'confirmSignup', email, code }),
  login: (email: string, password: string) =>
    api.post('/auth', { action: 'login', email, password }),
  verifyMfa: (email: string, password: string, code: string, session: string) =>
    api.post('/auth', { action: 'verifyMfa', email, password, code, session }),
  forgotPassword: (email: string) =>
    api.post('/auth', { action: 'forgotPassword', email }),
  confirmForgotPassword: (email: string, code: string, newPassword: string) =>
    api.post('/auth', { action: 'confirmForgotPassword', email, code, newPassword }),
};

export const decksApi = {
  create: (title: string, cards: { question: string; answer: string }[], createdBy: string) =>
    api.post('/decks', { title, cards, createdBy }),
  getAll: (createdBy: string) =>
    api.get(`/decks?createdBy=${encodeURIComponent(createdBy)}`),
  getById: (deckId: string) =>
    api.get(`/decks/${deckId}`),
};

export const roomsApi = {
  create: (deckId: string, createdBy: string, maxPlayers: number = 2, shuffle: boolean = false, timePerQuestion: number = 15) =>
    api.post('/rooms', { deckId, createdBy, maxPlayers, shuffle, timePerQuestion }),
};

export default api;
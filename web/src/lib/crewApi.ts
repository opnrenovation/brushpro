import axios from 'axios';
import { useCrewStore } from '@/stores/crew';

const crew = axios.create({ baseURL: '/api/v1/crew', timeout: 30000 });

crew.interceptors.request.use((config) => {
  const token = useCrewStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

crew.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      useCrewStore.getState().logout();
      if (typeof window !== 'undefined') window.location.href = '/crew/login';
    }
    return Promise.reject(err);
  },
);

export const crewApi = {
  login: (login: string, pin: string) => crew.post('/auth/login', { login, pin }),
  me: () => crew.get('/me'),
  clockIn: (data: { job_id?: string; notes?: string }) => crew.post('/clock-in', data),
  clockOut: (data: { break_minutes?: number; notes?: string }) => crew.post('/clock-out', data),
  switchJob: (data: { job_id?: string; break_minutes?: number }) => crew.post('/switch-job', data),
  timecard: (week?: string) => crew.get('/timecard', { params: week ? { week } : {} }),
  addTime: (data: unknown) => crew.post('/time-entries', data),
  updateTime: (id: string, data: unknown) => crew.patch(`/time-entries/${id}`, data),
  deleteTime: (id: string) => crew.delete(`/time-entries/${id}`),
  jobs: (all = false) => crew.get('/jobs', { params: all ? { all: '1' } : {} }),
  job: (id: string) => crew.get(`/jobs/${id}`),
  postUpdate: (id: string, data: { body: string; photo?: string }) => crew.post(`/jobs/${id}/updates`, data),
};

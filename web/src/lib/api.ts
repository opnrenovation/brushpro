import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: unknown) => api.patch('/settings', data),
  uploadLogo: (file: File) => {
    const fd = new FormData(); fd.append('logo', file);
    return api.post('/settings/logo', fd);
  },
};

// Leads
export const leadsApi = {
  list: (params?: Record<string, string>) => api.get('/leads', { params }),
  get: (id: string) => api.get(`/leads/${id}`),
  create: (data: unknown) => api.post('/leads', data),
  update: (id: string, data: unknown) => api.patch(`/leads/${id}`, data),
  addActivity: (id: string, data: unknown) => api.post(`/leads/${id}/activities`, data),
  convert: (id: string, data: unknown) => api.post(`/leads/${id}/convert`, data),
};

// Contacts
export const contactsApi = {
  list: (params?: Record<string, string>) => api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: unknown) => api.post('/contacts', data),
  update: (id: string, data: unknown) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  convert: (id: string) => api.post(`/contacts/${id}/convert`),
};

// Companies
export const companiesApi = {
  list: (params?: Record<string, string>) => api.get('/companies', { params }),
  get: (id: string) => api.get(`/companies/${id}`),
  create: (data: unknown) => api.post('/companies', data),
  update: (id: string, data: unknown) => api.patch(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};

// Customers
export const customersApi = {
  list: (params?: Record<string, string>) => api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post('/customers', data),
  update: (id: string, data: unknown) => api.patch(`/customers/${id}`, data),
};

// Jobs
export const jobsApi = {
  list: (params?: Record<string, string>) => api.get('/jobs', { params }),
  get: (id: string) => api.get(`/jobs/${id}`),
  create: (data: unknown) => api.post('/jobs', data),
  update: (id: string, data: unknown) => api.patch(`/jobs/${id}`, data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
  profitability: (id: string) => api.get(`/jobs/${id}/profitability`),
  addLabor: (id: string, data: unknown) => api.post(`/jobs/${id}/labor`, data),
  deleteLabor: (id: string, entryId: string) => api.delete(`/jobs/${id}/labor/${entryId}`),
  addExpense: (id: string, data: unknown) => api.post(`/jobs/${id}/expenses`, data),
  deleteExpense: (id: string, expenseId: string) => api.delete(`/jobs/${id}/expenses/${expenseId}`),
};

// Estimates
export const estimatesApi = {
  list: (params?: Record<string, string>) => api.get('/estimates', { params }),
  get: (id: string) => api.get(`/estimates/${id}`),
  create: (data: unknown) => api.post('/estimates', data),
  update: (id: string, data: unknown) => api.patch(`/estimates/${id}`, data),
  delete: (id: string) => api.delete(`/estimates/${id}`),
  send: (id: string) => api.post(`/estimates/${id}/send`),
  convert: (id: string) => api.post(`/estimates/${id}/convert`),
};

// Invoices
export const invoicesApi = {
  list: (params?: Record<string, string>) => api.get('/invoices', { params }),
  get: (id: string) => api.get(`/invoices/${id}`),
  create: (data: unknown) => api.post('/invoices', data),
  update: (id: string, data: unknown) => api.patch(`/invoices/${id}`, data),
  send: (id: string) => api.post(`/invoices/${id}/send`),
  addPayment: (id: string, data: unknown) => api.post(`/invoices/${id}/payments`, data),
  stripeLink: (id: string) => api.post(`/invoices/${id}/stripe-link`),
};

// Tax Profiles
export const taxProfilesApi = {
  list: () => api.get('/tax-profiles'),
  create: (data: unknown) => api.post('/tax-profiles', data),
  update: (id: string, data: unknown) => api.patch(`/tax-profiles/${id}`, data),
  delete: (id: string) => api.delete(`/tax-profiles/${id}`),
};

// Material Items
export const materialItemsApi = {
  list: (params?: Record<string, string>) => api.get('/material-items', { params }),
  create: (data: unknown) => api.post('/material-items', data),
  update: (id: string, data: unknown) => api.patch(`/material-items/${id}`, data),
  delete: (id: string) => api.delete(`/material-items/${id}`),
  export: () => api.get('/material-items/export', { responseType: 'blob' }),
};

// Contract Templates
export const contractTemplatesApi = {
  list: () => api.get('/contract-templates'),
  get: (id: string) => api.get(`/contract-templates/${id}`),
  create: (data: unknown) => api.post('/contract-templates', data),
  update: (id: string, data: unknown) => api.patch(`/contract-templates/${id}`, data),
  delete: (id: string) => api.delete(`/contract-templates/${id}`),
  preview: (id: string) => api.post(`/contract-templates/${id}/preview`),
};

// Scheduler
export const schedulerApi = {
  getSettings: () => api.get('/scheduler/settings'),
  updateSettings: (data: unknown) => api.patch('/scheduler/settings', data),
  getAvailabilityRules: () => api.get('/scheduler/availability-rules'),
  createAvailabilityRule: (data: unknown) => api.post('/scheduler/availability-rules', data),
  updateAvailabilityRule: (id: string, data: unknown) => api.patch(`/scheduler/availability-rules/${id}`, data),
  deleteAvailabilityRule: (id: string) => api.delete(`/scheduler/availability-rules/${id}`),
  getAppointmentTypes: () => api.get('/scheduler/appointment-types'),
  createAppointmentType: (data: unknown) => api.post('/scheduler/appointment-types', data),
  updateAppointmentType: (id: string, data: unknown) => api.patch(`/scheduler/appointment-types/${id}`, data),
  getAppointments: (params?: Record<string, string>) => api.get('/scheduler/appointments', { params }),
  createAppointment: (data: unknown) => api.post('/scheduler/appointments', data),
  updateAppointment: (id: string, data: unknown) => api.patch(`/scheduler/appointments/${id}`, data),
};

// Users
export const usersApi = {
  list: () => api.get('/users'),
  invite: (data: unknown) => api.post('/users/invite', data),
  update: (id: string, data: unknown) => api.patch(`/users/${id}`, data),
  resetPassword: (id: string) => api.post(`/users/${id}/reset`),
};

// Campaigns
export const campaignsApi = {
  list: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: unknown) => api.post('/campaigns', data),
  update: (id: string, data: unknown) => api.patch(`/campaigns/${id}`, data),
  send: (id: string) => api.post(`/campaigns/${id}/send`),
  analytics: (id: string) => api.get(`/campaigns/${id}/analytics`),
};

// Email Templates
export const emailTemplatesApi = {
  list: () => api.get('/email-templates'),
  get: (id: string) => api.get(`/email-templates/${id}`),
  create: (data: unknown) => api.post('/email-templates', data),
  update: (id: string, data: unknown) => api.patch(`/email-templates/${id}`, data),
  delete: (id: string) => api.delete(`/email-templates/${id}`),
};

// Vendors
export const vendorsApi = {
  list: (params?: Record<string, string>) => api.get('/vendors', { params }),
  get: (id: string) => api.get(`/vendors/${id}`),
  create: (data: unknown) => api.post('/vendors', data),
  update: (id: string, data: unknown) => api.patch(`/vendors/${id}`, data),
  delete: (id: string) => api.delete(`/vendors/${id}`),
};

// Reports
export const reportsApi = {
  tax: (params?: Record<string, string>) => api.get('/reports/tax', { params }),
  taxExport: () => api.get('/reports/tax/export', { responseType: 'blob' }),
  taxOutstanding: (params?: Record<string, string>) => api.get('/reports/tax/outstanding', { params }),
  profit: (params?: Record<string, string>) => api.get('/reports/profit', { params }),
  profitExport: () => api.get('/reports/profit/export', { responseType: 'blob' }),
  materials: (params?: Record<string, string>) => api.get('/reports/materials', { params }),
};

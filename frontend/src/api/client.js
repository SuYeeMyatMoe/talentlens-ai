import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/api/auth/register", data),
  login: (data) => api.post("/api/auth/login", data),
  me: () => api.get("/api/auth/me"),
};

// ─── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsAPI = {
  list: () => api.get("/api/jobs/"),
  get: (id) => api.get(`/api/jobs/${id}`),
  create: (data) => api.post("/api/jobs/", data),
  update: (id, data) => api.put(`/api/jobs/${id}`, data),
  delete: (id) => api.delete(`/api/jobs/${id}`),
  uploadResumes: (jobId, formData) => api.post(`/api/jobs/${jobId}/upload-resumes`, formData),
};

// ─── Applications ──────────────────────────────────────────────────────────────
export const applicationsAPI = {
  apply: (data) => api.post("/api/applications/", data),
  myApplications: () => api.get("/api/applications/my"),
  getJobCandidates: (jobId) => api.get(`/api/applications/job/${jobId}`),
  getDetail: (id) => api.get(`/api/applications/${id}`),
  uploadResume: (appId, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/applications/${appId}/upload-resume`, form);
  },
  makeDecision: (appId, decision) =>
    api.post(`/api/applications/${appId}/decision`, { decision }),
};

// ─── AI Analysis ──────────────────────────────────────────────────────────────
export const aiAPI = {
  runAnalysis: (jobId) => api.post(`/api/ai/run-analysis/${jobId}`),
  dashboardStats: () => api.get("/api/ai/dashboard-stats"),
  generateJob: (data) => api.post("/api/ai/generate-job", data),
};

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get("/api/notifications/"),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put("/api/notifications/mark-all-read"),
};

export default api;

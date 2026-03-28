import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE
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

  // file upload endpoint
  uploadResumes: (jobId, formData) =>
    api.post(`/api/jobs/${jobId}/upload-resumes`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── Applications ──────────────────────────────────────────────────────────────
export const applicationsAPI = {
  apply: (data) => api.post("/api/applications/", data),
  myApplications: () => api.get("/api/applications/my"),
  getJobCandidates: (jobId) => api.get(`/api/applications/job/${jobId}`),
  getDetail: (id) => api.get(`/api/applications/${id}`),

  // FIXED: resume upload
  uploadResume: (appId, file) => {
    const form = new FormData();
    form.append("file", file);

    return api.post(`/api/applications/${appId}/upload-resume`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  makeDecision: (appId, decision) =>
    api.post(`/api/applications/${appId}/decision`, { decision }),

  downloadResume: (appId) =>
    api.get(`/api/applications/${appId}/download-resume`, { responseType: "blob" }),
};

// ─── AI Analysis ──────────────────────────────────────────────────────────────
export const aiAPI = {
  runAnalysis: (jobId) => api.post(`/api/ai/run-analysis/${jobId}`),
  dashboardStats: () => api.get("/api/ai/dashboard-stats"),
  generateJob: (data) => api.post("/api/ai/generate-job", data),
  resumeQuality: (appId) => api.post(`/api/ai/resume-quality/${appId}`),
  compare: (jobId) => api.post(`/api/ai/compare/${jobId}`),
};

// ─── Interviews ────────────────────────────────────────────────────────────────
export const interviewsAPI = {
  suggest: (appId, data) => api.post(`/api/interviews/suggest/${appId}`, data),
  schedule: (appId, data) => api.post(`/api/interviews/schedule/${appId}`, data),
  get: (appId) => api.get(`/api/interviews/${appId}`),
  complete: (appId) => api.put(`/api/interviews/${appId}/complete`),
  respond: (appId, response) => api.put(`/api/interviews/${appId}/respond`, { response }),
};

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get("/api/notifications/"),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put("/api/notifications/mark-all-read"),
};

// ─── Blockchain Verification ───────────────────────────────────────────────────
export const blockchainAPI = {
  verify: (appId) => api.get(`/api/blockchain/verify/${appId}`),
};

export default api;

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Users, Briefcase, TrendingUp, Plus, ChevronRight,
  Play, CheckCircle2, XCircle, Clock, Sparkles, Bell
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { jobsAPI, aiAPI } from "../api/client";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b"];

export default function RecruiterDashboard() {
  const location = useLocation();
  const path = location.pathname;

  const showOverview = path === "/recruiter";
  const showAnalytics = path === "/recruiter" || path === "/recruiter/analytics";
  const showJobs = path === "/recruiter" || path === "/recruiter/jobs";
  const showNotifs = path === "/notifications";

  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);

  useEffect(() => {
    Promise.all([jobsAPI.list(), aiAPI.dashboardStats()]).then(([j, s]) => {
      setJobs(j.data);
      setStats(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const runAnalysis = async (jobId) => {
    setAnalyzing(jobId);
    try {
      const { data } = await aiAPI.runAnalysis(jobId);
      toast.success(`Analysis complete: ${data.processed} candidates processed`);
      const { data: updatedJobs } = await jobsAPI.list();
      setJobs(updatedJobs);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Analysis failed");
    } finally {
      setAnalyzing(null);
    }
  };

  const statCards = stats ? [
    { label: "Total Candidates", value: stats.total_candidates, icon: Users, color: "bg-primary-50 text-primary-600", delta: "+12%" },
    { label: "Active Jobs", value: stats.total_jobs, icon: Briefcase, color: "bg-blue-50 text-blue-600", delta: "+3" },
    { label: "Shortlisted", value: stats.shortlisted, icon: CheckCircle2, color: "bg-green-50 text-green-600", delta: `${stats.total_candidates ? Math.round(stats.shortlisted / stats.total_candidates * 100) : 0}%` },
    { label: "Avg Fairness", value: `${stats.avg_fairness_score}%`, icon: TrendingUp, color: "bg-violet-50 text-violet-600", delta: "+2.1%" },
  ] : [];

  const piData = stats ? [
    { name: "Shortlisted", value: stats.shortlisted },
    { name: "Rejected", value: stats.rejected },
    { name: "Pending", value: stats.pending },
  ] : [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="page-title">Recruiter Dashboard</h1>
            <p className="text-xs text-gray-400">Overview of your hiring pipeline</p>
          </div>
          <Link to="/recruiter/jobs/create" className="btn-primary">
            <Plus className="w-4 h-4" /> New Job
          </Link>
        </div>

        <div className="p-8 space-y-8 animate-fade-in">
          {/* Stat cards */}
          {showOverview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {statCards.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                      <s.icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{s.delta}</span>
                  </div>
                  <div className="text-3xl font-display font-bold text-gray-900">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Charts row */}
          {showAnalytics && stats && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Fairness trend */}
              <div className="lg:col-span-2 card p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-500" /> Fairness Score Trend
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.fairness_trend}>
                    <defs>
                      <linearGradient id="fairGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                    <Area type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2.5} fill="url(#fairGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div className="card p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" /> Decision Breakdown
                </h2>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={piData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {piData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {piData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Score distribution */}
          {showAnalytics && stats && (
            <div className="card p-6">
              <h2 className="section-title mb-4">Candidate Score Distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.score_distribution} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Job listings */}
          {showJobs && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="section-title">Job Listings</h2>
                <Link to="/recruiter/jobs/create" className="text-sm text-primary-600 font-medium hover:underline">+ Create Job</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-8 text-center text-gray-400">Loading jobs…</div>
                ) : jobs.length === 0 ? (
                  <div className="p-8 text-center">
                    <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">No jobs created yet</p>
                    <Link to="/recruiter/jobs/create" className="btn-primary mt-4 inline-flex">Create your first job</Link>
                  </div>
                ) : jobs.map((job) => (
                  <div key={job.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900 truncate">{job.title}</h3>
                        <span className={job.published ? "badge-green" : "badge-gray"}>
                          {job.published ? "Published" : "Draft"}
                        </span>
                        {job.analysis_run && <span className="badge-purple"><Sparkles className="w-2.5 h-2.5" /> AI Run</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {job.application_count} applicants</span>
                        {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.deadline).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!job.analysis_run && job.application_count > 0 && (
                        <button onClick={() => runAnalysis(job.id)} disabled={analyzing === job.id}
                          className="btn-primary py-1.5 px-3 text-xs">
                          {analyzing === job.id ? "Running…" : <><Play className="w-3 h-3" /> Run AI</>}
                        </button>
                      )}
                      <Link to={`/recruiter/jobs/${job.id}/candidates`} className="btn-secondary py-1.5 px-3 text-xs">
                        View Candidates <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Placeholder for Admin */}
          {showNotifs && (
            <div className="card p-12 text-center text-gray-400">
              <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p>No new notifications</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

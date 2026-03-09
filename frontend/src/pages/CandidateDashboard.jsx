import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase, Clock, CheckCircle2, XCircle, Upload,
  Bell, ChevronRight, Sparkles, FileText
} from "lucide-react";
import { jobsAPI, applicationsAPI, notificationsAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";

export default function CandidateDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const showOverview = path === "/candidate";
  const showJobsTab = path === "/candidate/jobs";
  const showNotifsTab = path === "/notifications";
  const [jobs, setJobs] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([jobsAPI.list(), applicationsAPI.myApplications(), notificationsAPI.list()])
      .then(([j, a, n]) => { setJobs(j.data); setMyApps(a.data); setNotifications(n.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const unread = notifications.filter(n => !n.read_status).length;
  const applied = myApps.map(a => a.job_id);

  const handleNotificationClick = async (notif) => {
    if (!notif.read_status) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_status: true } : n));
      try {
        await notificationsAPI.markRead(notif.id);
      } catch (err) {
        console.error("Failed to mark as read", err);
        // Provide rollback on failure if needed
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_status: false } : n));
      }
    }
  };

  const statusConfig = {
    applied: { icon: Clock, color: "text-gray-400", bg: "bg-gray-50", label: "Applied" },
    under_review: { icon: Sparkles, color: "text-blue-500", bg: "bg-blue-50", label: "Under Review" },
    shortlisted: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", label: "Shortlisted 🎉" },
    rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-50", label: "Not Selected" },
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar notifications={unread} />
      <main className="flex-1 ml-60">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="page-title">Welcome, {user?.name?.split(" ")[0]}</h1>
            <p className="text-xs text-gray-400">Find and apply to your next opportunity</p>
          </div>
          {unread > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-xl text-primary-700 text-sm font-medium">
              <Bell className="w-4 h-4" /> {unread} new notification{unread > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="p-8 space-y-8 animate-fade-in">
          {/* Stats row */}
          {showOverview && (
            <div className="grid grid-cols-3 gap-5">
              {[
                { label: "Applied", value: myApps.length, icon: FileText, color: "bg-primary-50 text-primary-600" },
                { label: "Under Review", value: myApps.filter(a => a.status === "under_review").length, icon: Sparkles, color: "bg-blue-50 text-blue-600" },
                { label: "Shortlisted", value: myApps.filter(a => a.status === "shortlisted").length, icon: CheckCircle2, color: "bg-green-50 text-green-600" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="stat-card">
                  <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div className="text-3xl font-display font-bold text-gray-900">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </motion.div>
              ))}
            </div>
          )}

          {/* My Applications */}
          {showOverview && myApps.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="section-title">My Applications</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {myApps.map((app) => {
                  const cfg = statusConfig[app.status] || statusConfig.applied;
                  const job = jobs.find(j => j.id === app.job_id);
                  return (
                    <div key={app.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                          <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{job?.title || `Job #${app.job_id}`}</div>
                          <div className="text-xs text-gray-400">Applied {new Date(app.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        {["shortlisted", "rejected"].includes(app.status) && (
                          <Link to={`/candidate/application/${app.id}`} className="btn-secondary py-1.5 px-3 text-xs">
                            View AI Report <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                        {app.status === "applied" && !app.resume && (
                          <Link to={`/candidate/job/${app.job_id}`} className="btn-primary py-1.5 px-3 text-xs">
                            <Upload className="w-3 h-3" /> Upload Resume
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notifications */}
          {(showOverview || showNotifsTab) && (notifications.length > 0 || showNotifsTab) && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="section-title">Notifications</h2>
                {unread > 0 && <span className="text-xs text-primary-600 font-medium">{unread} unread</span>}
              </div>
              <div className="divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No notifications yet</div>
                ) : notifications.slice(0, showNotifsTab ? undefined : 5).map((n) => (
                  <div key={n.id} onClick={() => handleNotificationClick(n)} className={`px-6 py-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read_status ? "bg-primary-50/40" : ""}`}>
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.read_status ? "bg-primary-500" : "bg-gray-200"}`} />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
                      <div className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse Jobs */}
          {(showOverview || showJobsTab) && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="section-title">Open Positions</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-8 text-center text-gray-400">Loading jobs…</div>
                ) : jobs.filter(j => j.published).length === 0 ? (
                  <div className="p-8 text-center">
                    <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400">No open positions yet</p>
                  </div>
                ) : jobs.filter(j => j.published).map((job) => (
                  <div key={job.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{job.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {job.deadline && <span><Clock className="w-3 h-3 inline mr-1" />Due {new Date(job.deadline).toLocaleDateString()}</span>}
                        <span>{job.application_count} applicants</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {applied.includes(job.id) ? (() => {
                        const app = myApps.find(a => a.job_id === job.id);
                        const cfg = statusConfig[app?.status] || statusConfig.applied;
                        return (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        );
                      })() : (
                        <Link to={`/candidate/job/${job.id}`} className="btn-primary py-1.5 px-4 text-xs">
                          Apply Now
                        </Link>
                      )}
                      <Link to={`/candidate/job/${job.id}`} className="btn-outline py-1.5 px-3 text-xs">
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

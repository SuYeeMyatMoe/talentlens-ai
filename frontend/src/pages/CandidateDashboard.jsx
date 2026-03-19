import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Clock, CheckCircle2, XCircle, Upload,
  Bell, ChevronRight, Sparkles, FileText, Calendar,
  Video, MapPin, Link2, ChevronDown, ChevronUp, Check, X,
  Loader2, ExternalLink, AlertCircle, Info
} from "lucide-react";
import { jobsAPI, applicationsAPI, notificationsAPI, interviewsAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";

// ─── Interview Detail Card (expandable inside notification) ─────────────────
function InterviewCard({ applicationId, onResponded }) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null); // 'accepted' | 'declined'

  useEffect(() => {
    interviewsAPI.get(applicationId)
      .then(r => setInterview(r.data))
      .catch(() => setInterview(null))
      .finally(() => setLoading(false));
  }, [applicationId]);

  const handleRespond = async (response) => {
    setResponding(response);
    try {
      await interviewsAPI.respond(applicationId, response);
      setInterview(prev => ({ ...prev, candidate_response: response }));
      toast.success(
        response === "accepted"
          ? "🎉 Interview accepted! The recruiter has been notified."
          : "Interview declined. The recruiter has been notified."
      );
      onResponded && onResponded();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to respond");
    } finally {
      setResponding(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!interview) return (
    <div className="py-4 text-center text-sm text-gray-400">
      <AlertCircle className="w-5 h-5 mx-auto mb-1 text-gray-300" />
      Unable to load interview details.
    </div>
  );

  const isOnline = interview.mode === "online";
  const responded = interview.candidate_response !== "pending";

  return (
    <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 overflow-hidden">
      {/* Date/Time/Mode row */}
      <div className="grid grid-cols-3 divide-x divide-blue-100">
        {[
          { icon: Calendar, label: "Date", value: interview.scheduled_date, color: "text-blue-600" },
          { icon: Clock, label: "Time", value: `${interview.scheduled_time} (${interview.duration_minutes} min)`, color: "text-indigo-600" },
          { icon: isOnline ? Video : MapPin, label: "Mode", value: isOnline ? "Online" : "In‑Person", color: isOnline ? "text-blue-600" : "text-orange-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5 leading-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* Meeting link */}
      {interview.meeting_link && (
        <div className="border-t border-blue-100 px-4 py-3 flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-xs text-gray-500 font-medium">Meeting Link:</span>
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1 truncate"
          >
            {interview.meeting_link}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {/* Location */}
      {!isOnline && interview.location && (
        <div className="border-t border-blue-100 px-4 py-3 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="text-xs text-gray-500 font-medium">Location:</span>
          <span className="text-xs text-gray-800">{interview.location}</span>
        </div>
      )}

      {/* Response area */}
      <div className="border-t border-blue-100 px-4 py-3">
        {responded ? (
          <div className={`flex items-center gap-2 text-sm font-medium ${interview.candidate_response === "accepted" ? "text-green-600" : "text-red-500"
            }`}>
            {interview.candidate_response === "accepted"
              ? <><Check className="w-4 h-4" /> You accepted this interview</>
              : <><X className="w-4 h-4" /> You declined this interview</>
            }
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Please respond to this invitation:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond("accepted")}
                disabled={!!responding}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-all disabled:opacity-60 shadow-sm"
              >
                {responding === "accepted"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><Check className="w-3.5 h-3.5" /> Accept</>
                }
              </button>
              <button
                onClick={() => handleRespond("declined")}
                disabled={!!responding}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold transition-all disabled:opacity-60"
              >
                {responding === "declined"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><X className="w-3.5 h-3.5" /> Decline</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Notification Item ───────────────────────────────────────────────
function NotificationItem({ notif, onMarkRead, onResponded }) {
  const [expanded, setExpanded] = useState(false);

  // Detect interview notification by title — works for both old (no application_id) and new
  const isInterview = notif.title?.includes("Interview Scheduled") || notif.title?.includes("Interview Scheduled!");
  // New-style: has application_id → show interactive card
  // Old-style: no application_id → show the message text inline when expanded
  const hasAppLink = !!notif.application_id;

  const toggleExpand = (e) => {
    e.stopPropagation();
    if (!notif.read_status) onMarkRead(notif.id);
    setExpanded(p => !p);
  };

  const handleRowClick = () => {
    if (!notif.read_status) onMarkRead(notif.id);
    if (isInterview) setExpanded(p => !p);
  };

  const typeStyles = {
    success: { dot: "bg-green-400", badge: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, iconColor: "text-green-500" },
    info: { dot: "bg-blue-400", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: Info, iconColor: "text-blue-500" },
    warning: { dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: AlertCircle, iconColor: "text-yellow-500" },
    decision: { dot: "bg-primary-400", badge: "bg-primary-50 text-primary-700 border-primary-200", icon: Sparkles, iconColor: "text-primary-500" },
  };

  const cfg = typeStyles[notif.type] || typeStyles.info;
  const NotifIcon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-5 py-4 transition-colors ${!notif.read_status ? "bg-blue-50/50" : "hover:bg-gray-50/60"}`}
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={handleRowClick}
      >
        {/* Unread dot */}
        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 transition-all ${!notif.read_status ? cfg.dot : "bg-gray-200"}`} />

        {/* Icon */}
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${cfg.badge}`}>
          <NotifIcon className={`w-4 h-4 ${cfg.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-semibold ${!notif.read_status ? "text-gray-900" : "text-gray-700"}`}>
              {notif.title}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">
              {new Date(notif.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {isInterview ? (
            /* Show expand button for all interview notifications */
            <button
              onClick={toggleExpand}
              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide details" : "View details"}
            </button>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
          )}
        </div>
      </div>

      {/* Expandable section */}
      <AnimatePresence>
        {isInterview && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden ml-11"
          >
            {hasAppLink ? (
              /* New-style: interactive card with schedule details + accept/decline */
              <InterviewCard
                applicationId={notif.application_id}
                onResponded={onResponded}
              />
            ) : (
              /* Legacy: just show the full message text */
              <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 px-4 py-4">
                <p className="text-xs text-gray-600 leading-relaxed">{notif.message}</p>
                <p className="text-[10px] text-blue-400 mt-2 italic">
                  This is an older notification. New interview invitations will include accept / decline options.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


// ─── Main Component ─────────────────────────────────────────────────────────
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

  const fetchAll = useCallback(() => {
    Promise.all([jobsAPI.list(), applicationsAPI.myApplications(), notificationsAPI.list()])
      .then(([j, a, n]) => { setJobs(j.data); setMyApps(a.data); setNotifications(n.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const unread = notifications.filter(n => !n.read_status).length;
  const applied = myApps.map(a => a.job_id);

  const handleMarkRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: false } : n));
    }
  };

  const statusConfig = {
    applied: { icon: Clock, color: "text-gray-400", bg: "bg-gray-50", label: "Applied" },
    under_review: { icon: Sparkles, color: "text-blue-500", bg: "bg-blue-50", label: "Under Review" },
    shortlisted: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", label: "Shortlisted 🎉" },
    interview_scheduled: { icon: Calendar, color: "text-blue-600", bg: "bg-blue-50", label: "Interview Scheduled" },
    interview_completed: { icon: CheckCircle2, color: "text-purple-600", bg: "bg-purple-50", label: "Interview Completed" },
    hired: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Hired 🎉" },
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
                        {["shortlisted", "rejected", "interview_scheduled", "interview_completed"].includes(app.status) && (
                          <Link to={`/candidate/application/${app.id}`} className="btn-secondary py-1.5 px-3 text-xs">
                            View Report <ChevronRight className="w-3 h-3" />
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
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-500" />
                  <h2 className="section-title">Notifications</h2>
                </div>
                {unread > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 font-semibold">
                    {unread} unread
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No notifications yet</p>
                  </div>
                ) : notifications.slice(0, showNotifsTab ? undefined : 5).map((n) => (
                  <NotificationItem
                    key={n.id}
                    notif={n}
                    onMarkRead={handleMarkRead}
                    onResponded={fetchAll}
                  />
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

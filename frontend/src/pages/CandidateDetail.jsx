import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, Shield, Brain, Link2,
  Briefcase, GraduationCap, Code2, Star, AlertTriangle, Sparkles,
  Calendar, Clock, Video, MapPin, Send, Loader2, X, ChevronRight
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { applicationsAPI, interviewsAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import ScoreCircle from "../components/ScoreCircle";
import toast from "react-hot-toast";

// ─── Interview Scheduling Modal ────────────────────────────────────────────────
function ScheduleInterviewModal({ appId, candidateName, jobTitle, onClose, onScheduled }) {
  const [step, setStep] = useState(1); // 1=Form, 2=Result
  const [mode, setMode] = useState("online");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Optional AI suggestion helper
  const [availability, setAvailability] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const r = await interviewsAPI.suggest(appId, { availability_notes: availability, mode });
      const s = r.data.suggestion;
      if (s?.suggested_date) setScheduledDate(s.suggested_date);
      if (s?.suggested_time) setScheduledTime(s.suggested_time);
      if (s?.duration_minutes) setDurationMinutes(s.duration_minutes);
      toast.success("AI suggestion applied to the form!");
      setShowAiPanel(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to get AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error("Please fill in the date and time.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: durationMinutes,
        mode,
        meeting_link: meetingLink,
        location,
        notes,
      };
      const r = await interviewsAPI.schedule(appId, payload);
      setResult(r.data);
      setStep(2);
      onScheduled && onScheduled();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Scheduling failed");
    } finally {
      setLoading(false);
    }
  };

  const durationOptions = [15, 30, 45, 60, 90, 120];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h2 className="text-lg font-bold">Schedule Interview</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-blue-100">{candidateName} · {jobTitle}</p>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* ── Step 1: Full manual form ── */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">

                  {/* AI Helper toggle */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-medium text-indigo-700">AI Schedule Helper</span>
                      <span className="text-xs text-indigo-400">(optional)</span>
                    </div>
                    <button
                      onClick={() => setShowAiPanel(p => !p)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold transition-colors"
                    >
                      {showAiPanel ? "Hide" : "Use AI Suggest"}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showAiPanel && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                          <label className="block text-xs font-medium text-gray-600">Your availability notes</label>
                          <textarea
                            value={availability}
                            onChange={e => setAvailability(e.target.value)}
                            placeholder="e.g. Prefer mornings, available Mon–Wed next week…"
                            rows={2}
                            className="w-full border border-indigo-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                          />
                          <button onClick={handleAiSuggest} disabled={aiLoading}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Brain className="w-4 h-4" /> Get AI Suggestion & Fill Form</>}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Mode */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Interview Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "online", label: "Online / Video Call", icon: Video },
                        { value: "onsite", label: "In-Person / On-site", icon: MapPin },
                      ].map(({ value, label, icon: Icon }) => (
                        <button key={value} onClick={() => setMode(value)}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${mode === value ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        <Calendar className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                        Interview Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={e => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        <Clock className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                        Start Time <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Duration
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {durationOptions.map(d => (
                        <button key={d} onClick={() => setDurationMinutes(d)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${durationMinutes === d ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}>
                          {d < 60 ? `${d} min` : `${d / 60}h`}{d === 45 && " (default)"}
                        </button>
                      ))}
                      {/* Custom duration */}
                      {!durationOptions.includes(durationMinutes) && (
                        <span className="px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-500 bg-blue-50 text-blue-700">
                          {durationMinutes} min (AI)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meeting link / location */}
                  {mode === "online" ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        <Link2 className="w-3.5 h-3.5 inline mr-1 text-green-500" />
                        Meeting Link
                        <span className="text-xs text-gray-400 font-normal ml-1">(auto-generated if blank)</span>
                      </label>
                      <input
                        type="text"
                        value={meetingLink}
                        onChange={e => setMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/... or Zoom/Teams link"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1 text-orange-500" />
                        Office Location / Room
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="e.g. Floor 3, Meeting Room A, Building B"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Additional Notes
                      <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Please prepare a 5-minute self-introduction, bring your portfolio…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleSchedule}
                    disabled={loading || !scheduledDate || !scheduledTime}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Schedule & Notify Candidate</>}
                  </button>
                </motion.div>
              )}

              {/* ── Step 2: Success ── */}
              {step === 2 && result && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-2">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-11 h-11 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Interview Scheduled!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {candidateName} has been notified and can accept or decline the invitation.
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 border border-gray-100">
                    {[
                      { icon: Calendar, color: "text-blue-500", label: "Date & Time", value: `${result.scheduled_date} at ${result.scheduled_time}` },
                      { icon: Clock, color: "text-indigo-500", label: "Duration", value: `${result.duration_minutes} minutes` },
                      { icon: result.mode === "online" ? Video : MapPin, color: result.mode === "online" ? "text-blue-500" : "text-orange-500", label: "Mode", value: result.mode === "online" ? "Online / Video Call" : "In-Person" },
                    ].map(({ icon: Icon, color, label, value }) => (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <Icon className={`w-4 h-4 ${color} shrink-0`} />
                        <span className="text-gray-500 w-24 shrink-0">{label}:</span>
                        <span className="font-medium text-gray-900">{value}</span>
                      </div>
                    ))}
                    {result.meeting_link && (
                      <div className="flex items-start gap-3 text-sm">
                        <Link2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-gray-500 w-24 shrink-0">Link:</span>
                        <a href={result.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-blue-600 underline break-all text-xs">{result.meeting_link}</a>
                      </div>
                    )}
                    {result.location && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-gray-500 w-24 shrink-0">Location:</span>
                        <span className="font-medium text-gray-900">{result.location}</span>
                      </div>
                    )}

                  </div>
                  <button onClick={onClose} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md">
                    Done
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CandidateDetail() {
  const { appId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interview, setInterview] = useState(null);

  const fetchData = () =>
    applicationsAPI.getDetail(appId).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));

  const fetchInterview = () =>
    interviewsAPI.get(appId).then(r => setInterview(r.data)).catch(() => setInterview(null));

  useEffect(() => {
    fetchData();
    fetchInterview();
  }, [appId]);

  const makeDecision = async (decision) => {
    setDeciding(decision);
    try {
      const r = await applicationsAPI.makeDecision(appId, decision);
      toast.success(`Candidate ${decision}! Blockchain: ${r.data.transaction_hash?.slice(0, 14)}…`);
      const updated = await applicationsAPI.getDetail(appId);
      setData(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Decision failed");
    } finally { setDeciding(null); }
  };

  const handleScheduled = () => {
    fetchData();
    fetchInterview();
    toast.success("Interview successfully scheduled! Candidate notified.");
  };

  const backPath = user?.role === "admin" ? -1 : "/candidate";

  if (loading) return (
    <div className="flex min-h-screen bg-gray-50"><Sidebar />
      <main className="flex-1 ml-60 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  if (!data) return null;

  const radarData = data.ranking ? [
    { subject: "Skill Match", value: data.ranking.skill_match_score },
    { subject: "Experience", value: data.ranking.experience_score },
    { subject: "Projects", value: data.ranking.project_score },
    { subject: "Diversity", value: data.ranking.diversity_score },
    { subject: "Soft Skills", value: data.ranking.soft_skills_score },
  ] : [];

  const isDecided = ["shortlisted", "rejected", "interview_scheduled", "interview_completed", "hired"].includes(data.status);
  const isShortlisted = ["shortlisted"].includes(data.status);
  const hasInterview = ["interview_scheduled", "interview_completed"].includes(data.status);
  const canSeeAI = user?.role === "admin" || isDecided;

  const statusColors = {
    shortlisted: "badge-green",
    rejected: "badge-red",
    interview_scheduled: "bg-blue-100 text-blue-700 border border-blue-200",
    interview_completed: "bg-purple-100 text-purple-700 border border-purple-200",
    hired: "bg-green-100 text-green-800 border border-green-200",
    applied: "bg-gray-100 text-gray-600",
    under_review: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center gap-4">
          <button onClick={() => navigate(backPath)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="page-title">{data.candidate_name}</h1>
            <p className="text-xs text-gray-400">{data.candidate_email} · Application #{data.application_id}</p>
          </div>

          {/* Blockchain verified badge */}
          {data.blockchain_verified && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-700 font-semibold">Blockchain Verified</span>
            </div>
          )}

          {/* Admin action buttons */}
          {user?.role === "admin" && !isDecided && (
            <div className="flex gap-2">
              <button onClick={() => makeDecision("shortlisted")} disabled={!!deciding}
                className="btn-primary py-2 px-4 text-sm">
                {deciding === "shortlisted" ? "…" : <><CheckCircle2 className="w-4 h-4" /> Shortlist</>}
              </button>
              <button onClick={() => makeDecision("rejected")} disabled={!!deciding}
                className="btn-danger py-2 px-4 text-sm">
                {deciding === "rejected" ? "…" : <><XCircle className="w-4 h-4" /> Reject</>}
              </button>
            </div>
          )}

          {/* Schedule Interview button — only for shortlisted */}
          {user?.role === "admin" && isShortlisted && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              Schedule Interview
            </button>
          )}

          {/* Status badge for decided states */}
          {isDecided && (
            <span className={`text-sm px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 ${statusColors[data.status] || "badge-gray"}`}>
              {data.status === "shortlisted" && <><CheckCircle2 className="w-4 h-4" /> Shortlisted</>}
              {data.status === "rejected" && <><XCircle className="w-4 h-4" /> Rejected</>}
              {data.status === "interview_scheduled" && <><Calendar className="w-4 h-4" /> Interview Scheduled</>}
              {data.status === "interview_completed" && <><CheckCircle2 className="w-4 h-4" /> Interview Completed</>}
              {data.status === "hired" && <><Star className="w-4 h-4" /> Hired</>}
            </span>
          )}
        </div>

        <div className="p-8 space-y-6 animate-fade-in">
          {/* Candidate not yet decided notice */}
          {!canSeeAI && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-sm text-yellow-700">AI analysis and fairness scores will be visible once the recruiter makes a decision.</p>
            </div>
          )}

          {/* Interview details card — when scheduled */}
          {hasInterview && interview && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 mb-1">Interview Scheduled</div>
                <div className="flex flex-wrap gap-4 text-sm text-blue-700">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{interview.scheduled_date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{interview.scheduled_time} ({interview.duration_minutes} min)</span>
                  <span className="flex items-center gap-1">
                    {interview.mode === "online" ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    {interview.mode === "online" ? "Online" : "In-Person"}
                  </span>
                </div>
                {interview.meeting_link && (
                  <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 underline mt-1">
                    <Link2 className="w-3 h-3" />{interview.meeting_link}
                  </a>
                )}
              </div>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: profile + AI score */}
            <div className="space-y-5">
              {/* Profile card */}
              <div className="card p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg font-display">
                    {data.candidate_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{data.candidate_name}</div>
                    <div className="text-sm text-gray-400">{data.candidate_email}</div>
                  </div>
                </div>

                {data.resume && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-500">Experience:</span>
                      <span className="font-medium text-gray-900">{data.resume.experience_years} years</span>
                    </div>
                    {data.resume.education && (
                      <div className="flex items-start gap-2 text-sm">
                        <GraduationCap className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <span className="text-gray-500">Education:</span>
                        <span className="font-medium text-gray-900 text-xs">{data.resume.education}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Score */}
              {canSeeAI && data.ranking && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 text-center">
                  <div className="flex items-center gap-2 justify-center mb-4 text-primary-600">
                    <Brain className="w-4 h-4" />
                    <span className="text-sm font-semibold">AI Score (Gemini Pro)</span>
                  </div>
                  <ScoreCircle score={data.ranking.final_score} size={100} strokeWidth={10} />
                  <div className="mt-3 text-sm text-gray-500">Raw: {data.ranking.raw_score?.toFixed(1)} / Fairness ×{data.ranking.fairness_factor?.toFixed(2)}</div>
                </motion.div>
              )}

              {/* Fairness score */}
              {canSeeAI && data.bias_report && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
                  <div className="flex items-center gap-2 mb-4 text-primary-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-semibold">Fairness Report</span>
                  </div>
                  <div className="text-center mb-4">
                    <div className="text-4xl font-display font-bold text-gray-900">{data.bias_report.fairness_score}%</div>
                    <div className={`text-xs font-medium mt-1 ${data.bias_report.fairness_score >= 85 ? "text-green-600" : "text-yellow-600"}`}>
                      {data.bias_report.fairness_score >= 85 ? "High Fairness" : "Moderate — Review"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Experience Bias", val: data.bias_report.experience_bias, max: 20 },
                      { label: "Education Bias", val: data.bias_report.education_bias, max: 15 },
                      { label: "Career Gap Bias", val: data.bias_report.career_gap_bias, max: 15 },
                    ].map(b => (
                      <div key={b.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{b.label}</span>
                          <span className={`font-medium ${b.val > 10 ? "text-yellow-600" : "text-green-600"}`}>{b.val.toFixed(0)}/{b.max}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${b.val > 10 ? "bg-yellow-400" : "bg-green-400"}`}
                            style={{ width: `${(b.val / b.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right: skills, projects, charts */}
            <div className="lg:col-span-2 space-y-5">
              {/* Skills */}
              {data.resume?.skills?.length > 0 && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Code2 className="w-4 h-4 text-primary-500" />
                    <h3 className="font-semibold text-gray-900">Skills Extracted</h3>
                    <span className="badge-gray ml-auto">{data.resume.skills.length} skills</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.resume.skills.map(s => <span key={s} className="badge-purple text-xs">{s}</span>)}
                  </div>
                </div>
              )}

              {/* Projects */}
              {data.resume?.projects?.length > 0 && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-gray-900">Projects</h3>
                  </div>
                  <ul className="space-y-2">
                    {data.resume.projects.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Radar chart */}
              {canSeeAI && data.ranking && radarData.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                    <h3 className="font-semibold text-gray-900">Score Breakdown</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} strokeWidth={2} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* AI Explanation */}
              {canSeeAI && data.ranking?.explanation && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-4 h-4 text-primary-500" />
                    <h3 className="font-semibold text-gray-900">Gemini AI Explanation</h3>
                  </div>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-body leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {data.ranking.explanation}
                  </pre>
                </motion.div>
              )}

              {/* Blockchain record */}
              {data.blockchain_verified && data.transaction_hash && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-6 border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-emerald-900 text-sm leading-tight">Blockchain Verification Record</h3>
                        <p className="text-xs text-emerald-600 mt-0.5">Immutable hiring decision log</p>
                      </div>
                    </div>
                    {/* Network live badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-700">Local Hardhat</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Tx Hash box */}
                    <div className="bg-white rounded-xl p-3 border border-emerald-100">
                      <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mb-1.5">
                        <Link2 className="w-3 h-3" /> Tx Hash
                      </div>
                      <code className="font-mono text-xs text-gray-800 break-all leading-relaxed">
                        {data.transaction_hash}
                      </code>
                    </div>

                    {/* Network / RPC row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-xl p-3 border border-emerald-100">
                        <div className="text-xs text-emerald-600 font-semibold mb-1">Network</div>
                        <div className="text-xs font-medium text-gray-800">Hardhat Local Node</div>
                        <div className="text-xs text-gray-400 mt-0.5">chainId: 31337</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-emerald-100">
                        <div className="text-xs text-emerald-600 font-semibold mb-1">RPC Endpoint</div>
                        <div className="text-xs font-mono text-gray-800">127.0.0.1:8545</div>
                        <div className="text-xs text-gray-400 mt-0.5">Zero gas cost</div>
                      </div>
                    </div>

                    {/* Confirmed pill */}
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-700 font-medium">
                        Decision permanently recorded on-chain — tamper-proof &amp; auditable
                      </span>
                    </div>

                    {/* Info note */}
                    <div className="bg-emerald-100/60 rounded-xl px-3 py-2 border border-emerald-200/50">
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        <span className="font-semibold">ℹ️ Local blockchain</span> — Running on Hardhat EDR.
                        No MATIC needed. For production, redeploy to Polygon Mainnet (~$0.01/decision).
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Interview Scheduling Modal */}
      {showScheduleModal && (
        <ScheduleInterviewModal
          appId={appId}
          candidateName={data.candidate_name}
          jobTitle="Position"
          onClose={() => setShowScheduleModal(false)}
          onScheduled={handleScheduled}
        />
      )}
    </div>
  );
}

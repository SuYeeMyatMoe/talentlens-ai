import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, Shield, Brain, Link2,
  Briefcase, GraduationCap, Code2, Star, AlertTriangle, Sparkles
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { applicationsAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import ScoreCircle from "../components/ScoreCircle";
import toast from "react-hot-toast";

export default function CandidateDetail() {
  const { appId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(null);

  useEffect(() => {
    applicationsAPI.getDetail(appId).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
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

  const isDecided = ["shortlisted", "rejected"].includes(data.status);
  const canSeeAI = user?.role === "admin" || isDecided;

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

          {/* Decision buttons (admin only) */}
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

          {/* Status badge */}
          {isDecided && (
            <span className={data.status === "shortlisted" ? "badge-green text-sm px-3 py-1.5" : "badge-red text-sm px-3 py-1.5"}>
              {data.status === "shortlisted" ? <><CheckCircle2 className="w-4 h-4" /> Shortlisted</> : <><XCircle className="w-4 h-4" /> Rejected</>}
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
                    <span className="text-sm font-semibold">AI Score</span>
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
                    <h3 className="font-semibold text-gray-900">Explainable AI Breakdown</h3>
                  </div>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-body leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {data.ranking.explanation}
                  </pre>
                </motion.div>
              )}

              {/* Blockchain record */}
              {data.blockchain_verified && data.transaction_hash && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 border-green-100 bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold text-green-800">Blockchain Verification Record</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">Tx Hash:</span>
                      <code className="font-mono text-xs text-green-800 bg-white px-2 py-0.5 rounded border border-green-100 break-all">{data.transaction_hash}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">Network:</span>
                      <span className="text-green-800">Polygon Mumbai Testnet</span>
                    </div>
                    <a href={`https://mumbai.polygonscan.com/tx/${data.transaction_hash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-green-700 underline">
                      View on PolygonScan ↗
                    </a>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

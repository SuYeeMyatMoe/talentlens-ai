import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, ChevronUp, ChevronDown, CheckCircle2,
  XCircle, Clock, Shield, Users, Sparkles, Download, Filter
} from "lucide-react";
import { applicationsAPI, jobsAPI, aiAPI } from "../api/client";
import Sidebar from "../components/Sidebar";
import ScoreCircle from "../components/ScoreCircle";
import toast from "react-hot-toast";

export default function CandidateRanking() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("final_score");
  const [sortDir, setSortDir] = useState("desc");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | shortlisted | pending | rejected

  useEffect(() => {
    Promise.all([jobsAPI.get(jobId), applicationsAPI.getJobCandidates(jobId)]).then(([j, c]) => {
      setJob(j.data);
      setCandidates(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [jobId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await aiAPI.runAnalysis(jobId);
      toast.success("AI analysis complete!");
      const [j, c] = await Promise.all([jobsAPI.get(jobId), applicationsAPI.getJobCandidates(jobId)]);
      setJob(j.data); setCandidates(c.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Analysis failed");
    } finally { setAnalyzing(false); }
  };

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const sorted = [...candidates]
    .filter(c => c.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
      c.candidate_email.toLowerCase().includes(search.toLowerCase()))
    .filter(c => {
      if (statusFilter === "shortlisted") return ["shortlisted", "interview_scheduled", "interview_completed", "hired"].includes(c.status);
      if (statusFilter === "pending") return !decidedStatuses.includes(c.status);
      if (statusFilter === "rejected") return c.status === "rejected";
      return true;
    })
    .sort((a, b) => {
      let va = sortBy === "final_score" ? a.ranking?.final_score ?? -1
        : sortBy === "fairness" ? a.bias_report?.fairness_score ?? -1
          : sortBy === "name" ? a.candidate_name : 0;
      let vb = sortBy === "final_score" ? b.ranking?.final_score ?? -1
        : sortBy === "fairness" ? b.bias_report?.fairness_score ?? -1
          : sortBy === "name" ? b.candidate_name : 0;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)
    : <ChevronDown className="w-3.5 h-3.5 opacity-30" />;

  const statusBadge = (status) => ({
    applied: <span className="badge-gray"><Clock className="w-3 h-3" /> Applied</span>,
    under_review: <span className="badge-blue"><Sparkles className="w-3 h-3" /> Reviewing</span>,
    shortlisted: <span className="badge-green"><CheckCircle2 className="w-3 h-3" /> Shortlisted</span>,
    rejected: <span className="badge-red"><XCircle className="w-3 h-3" /> Rejected</span>,
    interview_scheduled: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium"><Clock className="w-3 h-3" /> Interview</span>,
    interview_completed: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Interviewed</span>,
    hired: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Hired</span>,
  }[status] || <span className="badge-gray">{status}</span>);

  const decidedStatuses = ["shortlisted", "rejected", "interview_scheduled", "interview_completed", "hired"];

  // CSV download for shortlisted candidates
  const downloadCSV = () => {
    const shortlisted = candidates.filter(c =>
      ["shortlisted", "interview_scheduled", "interview_completed", "hired"].includes(c.status)
    );
    if (shortlisted.length === 0) { toast.error("No shortlisted candidates to export"); return; }
    const headers = ["Name", "Email", "Status", "AI Score", "Fairness Score", "Skills", "Experience (yrs)", "Blockchain Verified"];
    const rows = shortlisted.map(c => [
      c.candidate_name,
      c.candidate_email,
      c.status,
      c.ranking?.final_score?.toFixed(1) ?? "–",
      c.bias_report?.fairness_score?.toFixed(1) ?? "–",
      (c.resume?.skills || []).join("; "),
      c.resume?.experience_years ?? "–",
      c.blockchain_verified ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortlisted-${job?.title?.replace(/\s+/g, "-") ?? jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${shortlisted.length} shortlisted candidates`);
  };


  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60">
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center gap-4">
          <Link to="/recruiter" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="page-title">{job?.title || "Loading…"}</h1>
            <p className="text-xs text-gray-400">{candidates.length} candidates · {job?.published ? "Published" : "Draft"}</p>
          </div>
          {!job?.analysis_run && (
            <button onClick={runAnalysis} disabled={analyzing} className="btn-primary">
              {analyzing ? "Running AI…" : <><Sparkles className="w-4 h-4" /> Run AI Analysis</>}
            </button>
          )}
        </div>

        <div className="p-8">
          {/* Search + filter + export bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-10" placeholder="Search candidates…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {/* Status filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { value: "all", label: "All" },
                { value: "shortlisted", label: "✓ Shortlisted" },
                { value: "pending", label: "Pending" },
                { value: "rejected", label: "Rejected" },
              ].map(opt => (
                <button
                  key={opt.value}
                  id={`status-filter-${opt.value}`}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === opt.value
                      ? "bg-white text-primary-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />{candidates.filter(c => ["shortlisted", "interview_scheduled", "interview_completed", "hired"].includes(c.status)).length} Progressing</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />{candidates.filter(c => c.status === "rejected").length} Rejected</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" />{candidates.filter(c => !decidedStatuses.includes(c.status)).length} Pending</span>
              {/* CSV export */}
              <button
                id="export-csv"
                onClick={downloadCSV}
                className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors border border-green-200"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3.5 text-left">
                    <button onClick={() => handleSort("name")} className="table-header flex items-center gap-1 hover:text-gray-700">
                      Candidate <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <button onClick={() => handleSort("final_score")} className="table-header flex items-center gap-1 mx-auto hover:text-gray-700">
                      AI Score <SortIcon col="final_score" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <button onClick={() => handleSort("fairness")} className="table-header flex items-center gap-1 mx-auto hover:text-gray-700">
                      <Shield className="w-3 h-3" /> Fairness <SortIcon col="fairness" />
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-left table-header">Skills</th>
                  <th className="px-4 py-3.5 text-center table-header">Status</th>
                  <th className="px-4 py-3.5 text-center table-header">Verified</th>
                  <th className="px-4 py-3.5 text-right table-header">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Loading candidates…</td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400">No candidates yet</p>
                  </td></tr>
                ) : sorted.map((c, i) => (
                  <motion.tr key={c.application_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {c.candidate_name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{c.candidate_name}</div>
                          <div className="text-xs text-gray-400">{c.candidate_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {c.ranking ? (
                        <div className="flex flex-col items-center">
                          <ScoreCircle score={c.ranking.final_score} size={52} strokeWidth={6} />
                        </div>
                      ) : <span className="text-gray-300 text-sm">–</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {c.bias_report ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                          <Shield className="w-3 h-3" /> {c.bias_report.fairness_score}%
                        </div>
                      ) : <span className="text-gray-300 text-sm">–</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(c.resume?.skills || []).slice(0, 3).map(s => <span key={s} className="badge-purple">{s}</span>)}
                        {(c.resume?.skills?.length || 0) > 3 && <span className="badge-gray">+{c.resume.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">{statusBadge(c.status)}</td>
                    <td className="px-4 py-4 text-center">
                      {c.blockchain_verified
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link to={`/recruiter/application/${c.application_id}`} className="btn-secondary py-1.5 px-3 text-xs">
                        View Details
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

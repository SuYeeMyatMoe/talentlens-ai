import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Eye, Sparkles, Upload } from "lucide-react";
import { jobsAPI, aiAPI } from "../api/client";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";

export default function CreateJob() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", requirements: "", deadline: "", published: false });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedJobId, setSavedJobId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Job title is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, published: true };
      if (!payload.deadline) delete payload.deadline;
      const res = await jobsAPI.create(payload);
      toast.success("Job published!");
      setSavedJobId(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save job");
    } finally { setSaving(false); }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    const toastId = toast.loading("Uploading and parsing resumes...");
    try {
      await jobsAPI.uploadResumes(savedJobId, formData);
      toast.success("Resumes uploaded successfully!", { id: toastId });
      navigate("/recruiter");
    } catch (err) {
      toast.error("Failed to upload resumes", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const generateWithAI = async () => {
    if (!form.title.trim()) { toast.error("Please enter a job title first"); return; }
    setGenerating(true);
    const toastId = toast.loading("Generating description with AI...");
    try {
      const { data } = await aiAPI.generateJob({ title: form.title });
      setForm(prev => ({
        ...prev,
        description: prev.description ? prev.description + "\n\n" + data.description : data.description,
        requirements: prev.requirements ? prev.requirements + "\n\n" + data.requirements : data.requirements
      }));
      toast.success("Job description generated!", { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate job description", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60">
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center gap-4">
          <Link to="/recruiter" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="page-title">Create New Job</h1>
          <div className="ml-auto flex gap-2">
            {!savedJobId && (
              <button onClick={save} disabled={saving} className="btn-primary">
                <Eye className="w-4 h-4" /> {saving ? "Publishing…" : "Publish Job"}
              </button>
            )}
          </div>
        </div>

        <div className="p-8 max-w-2xl animate-fade-in">
          {savedJobId ? (
            <div className="card p-8 text-center space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Upload Candidates</h2>
                <p className="text-sm text-gray-500">Upload multiple resumes (PDF/DOCX) to automatically create candidate profiles and parse their skills for this job.</p>
              </div>

              <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 hover:border-primary-500 transition-colors bg-gray-50 relative">
                <input type="file" multiple accept=".pdf,.docx" onChange={handleUpload} disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                {uploading ? (
                  <p className="font-medium text-primary-600">Uploading and Parsing...</p>
                ) : (
                  <p className="font-medium text-gray-600">Drag & drop resumes here, or click to browse</p>
                )}
              </div>

              <button onClick={() => navigate("/recruiter")} className="text-sm text-gray-500 hover:text-gray-900 underline">
                I'll do this later
              </button>
            </div>
          ) : (
            <div className="card p-8 space-y-6">
              <div>
                <label className="label">Job Title *</label>
                <input className="input" placeholder="e.g. Senior Full Stack Engineer" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label !mb-0">Description & Requirements</label>
                  <button type="button" onClick={generateWithAI} disabled={generating || !form.title.trim()}
                    className="text-xs font-semibold flex items-center gap-1.5 text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Sparkles className="w-3.5 h-3.5" />
                    {generating ? "Generating…" : "Generate with AI"}
                  </button>
                </div>
                <textarea className="input min-h-[100px] resize-none" placeholder="Describe the role and responsibilities…"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <div>
                <label className="label">Requirements</label>
                <textarea className="input min-h-[100px] resize-none" rows={5}
                  placeholder="List required skills, experience, education…&#10;e.g. Python, React, 3+ years experience, Computer Science degree"
                  value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">The AI will use these requirements to match and score candidates.</p>
              </div>
              <div>
                <label className="label">Application Deadline</label>
                <input type="date" className="input" value={form.deadline}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

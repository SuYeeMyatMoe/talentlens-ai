import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Clock, Users } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { jobsAPI, applicationsAPI } from "../api/client";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [myApp, setMyApp] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState(null);

  useEffect(() => {
    jobsAPI.get(jobId).then(r => setJob(r.data)).catch(console.error);
    applicationsAPI.myApplications().then(r => {
      const app = r.data.find(a => a.job_id === parseInt(jobId));
      setMyApp(app || null);
    }).catch(console.error);
  }, [jobId]);

  const apply = async () => {
    try {
      const { data } = await applicationsAPI.apply({ job_id: parseInt(jobId) });
      setMyApp(data);
      toast.success("Applied successfully! Now upload your resume.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Application failed");
    }
  };

  const onDrop = useCallback(async (files) => {
    if (!myApp) { toast.error("Apply first before uploading resume"); return; }
    if (!files[0]) return;
    const f = files[0];
    if (!["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(f.type)) {
      toast.error("Only PDF or DOCX files accepted"); return;
    }
    setUploading(true);
    try {
      const { data } = await applicationsAPI.uploadResume(myApp.id, f);
      setParsed(data.parsed);
      toast.success("Resume uploaded and parsed successfully!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  }, [myApp]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }, maxFiles: 1 });

  if (!job) return (
    <div className="flex min-h-screen bg-gray-50"><Sidebar />
      <main className="flex-1 ml-60 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60">
        <div className="bg-white border-b border-gray-100 px-8 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/candidate")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">{job.title}</h1>
        </div>

        <div className="p-8 max-w-3xl space-y-6 animate-fade-in">
          {/* Job info */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-display font-bold text-gray-900">{job.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                  {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Deadline: {new Date(job.deadline).toLocaleDateString()}</span>}
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {job.application_count} applicants</span>
                </div>
              </div>
              <span className="badge-green">Open</span>
            </div>
            {job.description && <p className="text-sm text-gray-600 leading-relaxed mb-4">{job.description}</p>}
            {job.requirements && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Requirements</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}
          </div>

          {/* Apply / Upload */}
          {!myApp ? (
            <div className="card p-6 text-center">
              <FileText className="w-12 h-12 text-primary-200 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Interested in this role?</h3>
              <p className="text-sm text-gray-500 mb-4">Click Apply to create your application, then upload your resume.</p>
              <button onClick={apply} className="btn-primary mx-auto">Apply Now</button>
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <h3 className="font-semibold text-gray-900">Application #{ myApp.id }</h3>
                <span className="badge-green ml-auto">Applied</span>
              </div>

              {/* Resume upload */}
              {!myApp.resume && !parsed && (
                <div>
                  <p className="text-sm text-gray-500 mb-4">Upload your resume (PDF or DOCX). Your name and email are taken from your account — no need to include them.</p>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                    ${isDragActive ? "border-primary-400 bg-primary-50" : "border-gray-200 hover:border-primary-300 hover:bg-gray-50"}`}>
                    <input {...getInputProps()} />
                    {uploading ? (
                      <div>
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Parsing resume…</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-700">{isDragActive ? "Drop it here!" : "Drag & drop your resume"}</p>
                        <p className="text-xs text-gray-400 mt-1">PDF or DOCX · Max 10MB</p>
                        <button type="button" className="btn-primary mt-4 mx-auto text-xs py-2">Browse Files</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parsed result */}
              {parsed && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 rounded-2xl p-5 border border-green-100">
                  <div className="flex items-center gap-2 mb-3 text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold text-sm">Resume parsed successfully!</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium text-gray-700">Skills: </span><span className="text-gray-600">{parsed.skills?.join(", ")}</span></div>
                    <div><span className="font-medium text-gray-700">Experience: </span><span className="text-gray-600">{parsed.experience_years} years</span></div>
                    <div><span className="font-medium text-gray-700">Education: </span><span className="text-gray-600">{parsed.education}</span></div>
                    <div><span className="font-medium text-gray-700">Projects: </span><span className="text-gray-600">{parsed.projects?.length} detected</span></div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain, Shield, BarChart3, Link2, Sparkles,
  ChevronRight, CheckCircle2, Zap, Users, Award
} from "lucide-react";

const FEATURES = [
  { icon: Brain, title: "AI-Powered Analysis", desc: "Sentence-BERT embeddings + LLM post-processing for near-perfect resume parsing and candidate scoring.", color: "bg-primary-100 text-primary-600" },
  { icon: Shield, title: "Bias Detection", desc: "Automatic fairness scoring across experience, education, and career gaps. Every candidate gets a fair shot.", color: "bg-blue-100 text-blue-600" },
  { icon: BarChart3, title: "Explainable AI", desc: "Human-readable breakdown of every score. Understand why candidates rank the way they do.", color: "bg-violet-100 text-violet-600" },
  { icon: Link2, title: "Blockchain Verified", desc: "Every hiring decision is immutably logged on Polygon testnet. Full audit trail for compliance.", color: "bg-indigo-100 text-indigo-600" },
  { icon: Users, title: "Dual Role System", desc: "Separate flows for candidates and recruiters. Each gets exactly what they need, nothing more.", color: "bg-sky-100 text-sky-600" },
  { icon: Award, title: "Verified Badges", desc: "Candidates receive blockchain-backed verification badges with transaction hashes upon decision.", color: "bg-purple-100 text-purple-600" },
];

const STATS = [
  { value: "98%", label: "Parse Accuracy" },
  { value: "< 2s", label: "Analysis Time" },
  { value: "100%", label: "Audit Coverage" },
  { value: "0", label: "Bias Tolerance" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Candidate Registers", desc: "Create an account. Your identity is secured — never pulled from your resume." },
  { step: "02", title: "Apply & Upload Resume", desc: "Browse published jobs and upload your PDF or DOCX resume." },
  { step: "03", title: "AI Runs Analysis", desc: "Recruiter triggers analysis. Skills, experience, and projects are scored with full fairness check." },
  { step: "04", title: "Decision + Blockchain Log", desc: "Shortlisted or not — the decision is logged on-chain. You receive instant notification with full AI breakdown." },
];

export default function Landing() {
  return (
    <div className="min-h-screen mesh-bg font-body">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gray-900 text-lg">TalentLens <span className="text-primary-600">AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600 font-medium">
            <a href="#features" className="hover:text-primary-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary-600 transition-colors">How it Works</a>
            <a href="#stats" className="hover:text-primary-600 transition-colors">Impact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-outline text-sm py-2 px-4">Sign In</Link>
            <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-full text-primary-700 text-xs font-semibold mb-6 border border-primary-100">
              <Zap className="w-3 h-3" />
              AI-Powered · Bias-Free · Blockchain-Verified
            </div>
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-gray-900 leading-[1.1] mb-6">
              Hire Smarter.<br />
              <span className="bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent">Fairer. Faster.</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed mb-8 max-w-lg">
              TalentLens AI transforms your hiring pipeline with intelligent resume analysis, automatic bias detection, and immutable blockchain records.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary text-base px-6 py-3">
                Start Free <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 relative overflow-hidden">
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-100 to-transparent rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-100 to-transparent rounded-full translate-y-8 -translate-x-8" />

              {/* Candidate Card */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold font-display">SA</div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">Sarah Ahmed</div>
                    <div className="text-xs text-gray-400">Full Stack Engineer · 4 yrs</div>
                  </div>
                  <div className="ml-auto badge badge-green">Shortlisted</div>
                </div>

                {/* Score gauge */}
                <div className="flex items-center gap-6 mb-5 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="40" cy="40" r="32" fill="none" stroke="url(#grad)" strokeWidth="8"
                        strokeDasharray="201" strokeDashoffset="40" strokeLinecap="round" />
                      <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold font-display text-gray-900">87</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: "Skill Match", val: 92, color: "bg-primary-500" },
                      { label: "Experience", val: 78, color: "bg-blue-500" },
                      { label: "Projects", val: 85, color: "bg-violet-500" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-500">{item.label}</span>
                          <span className="font-medium text-gray-700">{item.val}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {["React", "Python", "FastAPI", "Docker", "AWS", "PostgreSQL"].map((s) => (
                    <span key={s} className="badge-purple text-xs">{s}</span>
                  ))}
                </div>

                {/* Blockchain badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100 text-xs">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-green-700 font-medium">Blockchain Verified</span>
                  <span className="text-gray-400 font-mono ml-auto">0x7f3a…c8b2</span>
                </div>
              </div>
            </div>

            {/* Floating fairness card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-soft border border-gray-100 p-3.5 min-w-[160px]">
              <div className="text-xs text-gray-400 mb-1">Fairness Score</div>
              <div className="text-2xl font-bold font-display text-primary-600">94%</div>
              <div className="text-xs text-green-600 font-medium">✓ High Fairness</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-y border-gray-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="text-center">
              <div className="text-4xl font-display font-bold bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Everything You Need to Hire Right</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">Six powerful capabilities working together to eliminate bias and automate your hiring workflow.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} viewport={{ once: true }}
              className="card p-6 hover:shadow-soft transition-shadow duration-300">
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">How TalentLens Works</h2>
            <p className="text-lg text-gray-500">Four steps from application to verified decision.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="relative">
                <div className="card p-6">
                  <div className="text-5xl font-display font-bold text-primary-100 mb-3">{step.step}</div>
                  <h3 className="font-display font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-3 text-gray-300">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="bg-gradient-to-br from-primary-600 to-blue-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-4xl font-display font-bold mb-4">Ready to Transform Your Hiring?</h2>
          <p className="text-primary-100 text-lg mb-8 max-w-lg mx-auto">Join TalentLens AI and experience bias-free, transparent, and intelligent hiring today.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/register" className="bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors">
              Create Free Account
            </Link>
            <Link to="/login" className="border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors">
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-gray-700">TalentLens AI</span>
          </div>
          <span>Built for hackathon · Powered by AI · Verified by Blockchain</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * BlockchainVerifyModal
 *
 * Opens when the user clicks "Verify My Record" / "Verify Blockchain Record".
 * 1. Calls  GET /api/blockchain/verify/:appId  to fetch stored on-chain data.
 * 2. Optionally lets the user paste resume text so we can recompute the hash
 *    client-side with the Web Crypto API and compare it against the stored hash.
 * 3. Presents a detailed verification card with animated pass/fail indicators.
 *
 * Works for BOTH candidate (own record) and admin (any record they manage).
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Shield, CheckCircle2, XCircle, Link2, Loader2,
  ChevronDown, ChevronUp, Copy, ExternalLink, RefreshCw,
  FileText, Hash, ClipboardCheck, Lock, Zap,
  Star, Code2, Briefcase, GraduationCap, TrendingUp, BarChart3
} from "lucide-react";
import { blockchainAPI } from "../api/client";
import toast from "react-hot-toast";

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** SHA-256 of a UTF-8 string using the browser's Web Crypto API */
async function sha256Browser(text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return "0x" + Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function short(h = "", n = 8) {
  if (!h) return "—";
  return `${h.slice(0, n + 2)}…${h.slice(-6)}`;
}

function fmtTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch { return iso; }
}

// ── Sub-components ───────────────────────────────────────────────────────────────

function VerifyRow({ label, status, left, right }) {
  // status: "match" | "mismatch" | "unknown"
  const icon = status === "match"
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    : status === "mismatch"
      ? <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />;

  const bg = status === "match"
    ? "bg-emerald-50 border-emerald-100"
    : status === "mismatch"
      ? "bg-red-50 border-red-100"
      : "bg-gray-50 border-gray-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {status === "match" && <span className="ml-auto text-xs font-bold text-emerald-600">✅ Match</span>}
        {status === "mismatch" && <span className="ml-auto text-xs font-bold text-red-600">❌ Mismatch</span>}
        {status === "unknown" && <span className="ml-auto text-xs text-gray-400">Not checked</span>}
      </div>
      {(left || right) && (
        <div className="grid grid-cols-1 gap-1">
          {left && (
            <div className="flex gap-1.5">
              <span className="text-xs text-gray-400 w-20 shrink-0">On-chain:</span>
              <code className="text-xs font-mono text-gray-700 break-all leading-relaxed">{left}</code>
            </div>
          )}
          {right && (
            <div className="flex gap-1.5">
              <span className="text-xs text-gray-400 w-20 shrink-0">Computed:</span>
              <code className={`text-xs font-mono break-all leading-relaxed ${status === "match" ? "text-emerald-700" : status === "mismatch" ? "text-red-700" : "text-gray-700"
                }`}>{right}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="p-1 rounded-lg hover:bg-white/50 transition-colors"
    >
      {copied
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />
      }
    </button>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────────

export default function BlockchainVerifyModal({ appId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);       // raw API response
  const [error, setError] = useState(null);

  // resume text pasted by user for client-side hash check
  const [resumeText, setResumeText] = useState("");
  const [computedHash, setComputedHash] = useState(null);
  const [hashLoading, setHashLoading] = useState(false);

  const [showRaw, setShowRaw] = useState(false);

  // ── Fetch on-chain record ──────────────────────────────────────────────────
  const fetchRecord = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRecord(null);
    setComputedHash(null);
    try {
      const res = await blockchainAPI.verify(appId);
      setRecord(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch blockchain record.");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  // Auto-fetch on mount
  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // ── Client-side hash recomputation ────────────────────────────────────────
  // If the user pasted a plain hex hash (with or without 0x), compare it directly.
  // If they pasted resume text, compute SHA-256 in the browser and compare.
  const isHexInput = (() => {
    const t = resumeText.trim();
    if (!t) return false;
    if (/^0x[0-9a-fA-F]{40,130}$/.test(t)) return true;
    if (/^[0-9a-fA-F]{40,128}$/.test(t)) return true;
    return false;
  })();

  const handleComputeHash = async () => {
    if (!resumeText.trim()) {
      toast.error("Please paste your resume text or hash first.");
      return;
    }
    setHashLoading(true);
    try {
      if (isHexInput) {
        // Direct hash comparison — normalise to 0x format
        const t = resumeText.trim();
        const normalised = t.startsWith("0x") ? t : "0x" + t;
        setComputedHash(normalised);
      } else {
        // Resume text — compute SHA-256 in browser (fully trustless)
        const h = await sha256Browser(resumeText.trim());
        setComputedHash(h);
      }
    } catch {
      toast.error("Verification failed.");
    } finally {
      setHashLoading(false);
    }
  };

  // ── Derive check statuses ─────────────────────────────────────────────────
  const onChain = record?.on_chain;

  const storedHash = onChain?.resume_hash
    ? (onChain.resume_hash.startsWith("0x") ? onChain.resume_hash : "0x" + onChain.resume_hash)
    : null;

  // Server-side auto-check: backend recomputes hash from DB raw_text independently
  const serverHashStatus = (() => {
    if (!record) return "unknown";
    const expected = record.expected_resume_hash;
    if (!expected || !storedHash) return "unknown";
    return expected.toLowerCase() === storedHash.toLowerCase() ? "match" : "mismatch";
  })();

  // User-paste (manual) hash check — optional, additive
  const hashStatus = (() => {
    if (!computedHash) return "unknown";
    if (!storedHash) return "unknown";
    return computedHash.toLowerCase() === storedHash.toLowerCase() ? "match" : "mismatch";
  })();

  // looksLikeHex kept as alias to isHexInput for JSX references below
  const looksLikeHex = false; // no longer used to block — isHexInput handles the mode switch

  const scoreStatus = (() => {
    if (!record) return "unknown";
    const stored = Number(onChain?.score);
    const expected = record.expected_score != null ? Math.round(record.expected_score) : null;
    if (expected == null) return "unknown";
    return Math.abs(stored - expected) <= 1 ? "match" : "mismatch";
  })();

  const fairnessStatus = (() => {
    if (!record) return "unknown";
    const stored = Number(onChain?.fairness_score);
    const expected = record.expected_fairness != null ? Math.round(record.expected_fairness) : null;
    if (expected == null) return "unknown";
    return Math.abs(stored - expected) <= 1 ? "match" : "mismatch";
  })();

  const decisionStatus = (() => {
    if (!record) return "unknown";
    return onChain?.decision === record.expected_decision ? "match" : "mismatch";
  })();

  // Core fields only — hash is optional/user-initiated and must NOT affect core banner
  const coreFailed =
    scoreStatus === "mismatch" ||
    fairnessStatus === "mismatch" ||
    decisionStatus === "mismatch";

  const coreVerified =
    scoreStatus === "match" &&
    fairnessStatus === "match" &&
    decisionStatus === "match";


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          style={{ boxShadow: "0 32px 80px rgba(16,185,129,0.18), 0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div
            className="relative px-6 py-5 text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)",
            }}
          >
            {/* Radial glow effect */}
            <div className="absolute inset-0 opacity-30" style={{
              background: "radial-gradient(ellipse 80% 80% at 50% -20%, rgba(16,185,129,0.5), transparent)"
            }} />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                  <Shield className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Blockchain Verification</h2>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    Independently verify your hiring decision on-chain
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchRecord}
                  title="Refresh"
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Network pill */}
            <div className="relative mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-200">Local Hardhat · chainId 31337</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur">
                <Lock className="w-3 h-3 text-emerald-300" />
                <span className="text-xs text-emerald-200">Tamper-proof</span>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ───────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5">

              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  <p className="text-sm text-gray-500">Fetching on-chain record…</p>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center"
                >
                  <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                  <p className="text-xs text-red-400 mt-1">
                    A decision must be recorded before verification is available.
                  </p>
                  <button
                    onClick={fetchRecord}
                    className="mt-3 text-xs text-red-600 underline"
                  >
                    Try again
                  </button>
                </motion.div>
              )}

              {/* ── Record loaded ───────────────────────────────────────── */}
              {record && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Overall status banner — only reflects CORE fields */}
                  <div className={`rounded-2xl p-4 border flex items-center gap-3 ${coreFailed
                      ? "bg-red-50 border-red-200"
                      : "bg-emerald-50 border-emerald-100"
                    }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${coreFailed ? "bg-red-100" : "bg-emerald-100"
                      }`}>
                      {coreFailed
                        ? <XCircle className="w-5 h-5 text-red-600" />
                        : <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      }
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${coreFailed ? "text-red-800" : "text-emerald-800"}`}>
                        {coreFailed ? "⚠️ Core Record Mismatch" : "✅ Core Record Verified"}
                      </div>
                      <div className={`text-xs mt-0.5 ${coreFailed ? "text-red-600" : "text-emerald-600"}`}>
                        {coreFailed
                          ? "Score, fairness or decision does not match the blockchain record."
                          : "Score, fairness & decision all match the immutable on-chain record."
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── Candidate / Application Info ────────────────────── */}
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Candidate</div>
                        <div className="font-semibold text-gray-900">{record.candidate_name}</div>
                        <div className="text-xs text-gray-500">{record.candidate_email}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Application ID</div>
                        <div className="font-bold text-gray-900 font-mono">#{record.application_id}</div>
                      </div>
                    </div>
                  </div>

                  {/* ── Tx Hash ─────────────────────────────────────────── */}
                  <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Transaction Hash</span>
                      <CopyButton text={onChain.transaction_hash || ""} />
                    </div>
                    <code className="text-xs font-mono text-emerald-300 break-all leading-relaxed">
                      {onChain.transaction_hash || "—"}
                    </code>
                  </div>

                  {/* ── Metadata row ─────────────────────────────────────── */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Decision", value: onChain.decision, mono: false, cap: true },
                      { label: "Block", value: onChain.block_number ?? "Local", mono: true },
                      { label: "Timestamp", value: fmtTimestamp(onChain.timestamp), mono: false, small: true },
                    ].map(({ label, value, mono, cap, small }) => (
                      <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <div className="text-xs text-gray-400 mb-1">{label}</div>
                        <div className={`font-semibold text-gray-900 ${small ? "text-xs" : "text-sm"} ${mono ? "font-mono" : ""} ${cap ? "capitalize" : ""}`}>
                          {value ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Verification Checks ──────────────────────────────── */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardCheck className="w-3.5 h-3.5" /> Verification Checks
                    </div>

                    <VerifyRow
                      label="AI Score"
                      status={scoreStatus}
                      left={`${onChain.score ?? "—"}/100`}
                      right={record.expected_score != null ? `${Math.round(record.expected_score)}/100` : null}
                    />

                    <VerifyRow
                      label="Fairness Score"
                      status={fairnessStatus}
                      left={`${onChain.fairness_score ?? "—"}%`}
                      right={record.expected_fairness != null ? `${Math.round(record.expected_fairness)}%` : null}
                    />

                    <VerifyRow
                      label="Hiring Decision (Original)"
                      status={decisionStatus}
                      left={onChain.decision}
                      right={record.expected_decision}
                    />

                    {/* Resume Hash — shows server auto-check, user check is additive */}
                    <VerifyRow
                      label="Resume Hash (Server Auto-Check)"
                      status={serverHashStatus}
                      left={storedHash ? short(storedHash, 12) : "—"}
                      right={record?.expected_resume_hash ? short(record.expected_resume_hash, 12) : null}
                    />
                  </div>

                  {/* Server hash explanation */}
                  {serverHashStatus === "match" && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-xs text-emerald-700 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                      <strong>Server auto-verify passed:</strong> The resume text in the database produces
                      the same hash as what was recorded on-chain at decision time.
                      Use the section below to also independently verify with <em>your own copy</em> of the resume.
                    </div>
                  )}
                  {serverHashStatus === "mismatch" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700 leading-relaxed">
                      <XCircle className="w-3.5 h-3.5 inline mr-1 text-red-500" />
                      <strong>Database hash mismatch:</strong> The resume text stored in the database no longer matches
                      the hash recorded on-chain. This may indicate the resume was altered after the decision was made.
                    </div>
                  )}

                  {/* ── Resume hash / text verification panel ─── */}
                   <div className="border border-dashed border-emerald-200 rounded-2xl p-4 bg-emerald-50/40">
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">
                        {isHexInput ? "Compare Hash Directly" : "Verify with Your Resume Text"}
                      </span>
                      <span className="text-xs text-emerald-500 ml-auto">(optional · trustless)</span>
                    </div>

                    {/* Blue info box — shown when a hash is pasted */}
                    {isHexInput && resumeText.trim() && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2"
                      >
                        <span className="text-base shrink-0">🔗</span>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          <strong>Hash detected.</strong>{" "}
                          Click <em>Compare Hash Directly</em> to match it against the on-chain fingerprint.
                          For fully trustless verification, paste your plain resume text instead.
                        </p>
                      </motion.div>
                    )}

                    {/* Textarea with Clear button */}
                    <div className="relative">
                      <textarea
                        value={resumeText}
                        onChange={(e) => {
                          setResumeText(e.target.value);
                          setComputedHash(null);
                        }}
                        placeholder="Paste your resume hash or full resume text here…"
                        rows={4}
                        className={`w-full border rounded-xl p-3 pr-14 text-xs font-mono text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none bg-white ${
                          isHexInput ? "border-blue-300 focus:ring-blue-200" : "border-emerald-200 focus:ring-emerald-300"
                        }`}
                      />
                      {resumeText && (
                        <button
                          onClick={() => { setResumeText(""); setComputedHash(null); }}
                          className="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500 bg-white border border-gray-200 rounded-lg px-2 py-0.5 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Action button */}
                    <button
                      onClick={handleComputeHash}
                      disabled={hashLoading || !resumeText.trim()}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                    >
                      {hashLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isHexInput ? "Comparing\u2026" : "Computing\u2026"}</>
                        : isHexInput
                          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Compare Hash Directly</>
                          : <><Zap className="w-3.5 h-3.5" /> Compute SHA-256 &amp; Compare</>
                      }
                    </button>

                    {/* Result */}
                    {computedHash && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className={`rounded-xl p-3 border flex items-start gap-2 ${hashStatus === "match"
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-red-50 border-red-200"
                          }`}>
                          {hashStatus === "match"
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          }
                          <div>
                            <div className={`text-xs font-bold ${hashStatus === "match" ? "text-emerald-700" : "text-red-700"}`}>
                              {hashStatus === "match"
                                ? isHexInput
                                  ? "\u2705 Hash matches the on-chain fingerprint!"
                                  : "\u2705 Resume text hashes to the same on-chain fingerprint!"
                                : isHexInput
                                  ? "\u274c Hash does not match the on-chain record."
                                  : "\u274c SHA-256 mismatch \u2014 resume text may differ from what was evaluated."
                              }
                            </div>
                            <code className="text-xs font-mono break-all text-gray-600 mt-0.5 block">{computedHash}</code>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* ── Resume Analysis Panel ────────────────────────── */}
                  {coreVerified && hashStatus === "match" && record.resume_analysis && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="border border-emerald-100 rounded-2xl overflow-hidden bg-white"
                    >
                      {/* Header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center gap-2">
                        <Star className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-800">Resume Analysis</span>
                        <span className="ml-auto text-xs text-emerald-500">Verified • Tamper-proof</span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Skills */}
                        {record.resume_analysis.skills?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                              <Code2 className="w-3.5 h-3.5" /> Skills Extracted
                              <span className="ml-1 text-emerald-600 font-bold">({record.resume_analysis.skills.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {record.resume_analysis.skills.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-700">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Experience & Education row */}
                        <div className="grid grid-cols-2 gap-3">
                          {record.resume_analysis.experience_years != null && (
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold mb-1">
                                <Briefcase className="w-3 h-3" /> Experience
                              </div>
                              <div className="text-sm font-bold text-gray-800">
                                {record.resume_analysis.experience_years} yr{record.resume_analysis.experience_years !== 1 ? "s" : ""}
                              </div>
                            </div>
                          )}
                          {record.resume_analysis.education && (
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold mb-1">
                                <GraduationCap className="w-3 h-3" /> Education
                              </div>
                              <div className="text-xs font-medium text-gray-700 leading-snug line-clamp-2">
                                {record.resume_analysis.education}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Projects */}
                        {record.resume_analysis.projects?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                              <TrendingUp className="w-3.5 h-3.5" /> Projects
                            </div>
                            <ul className="space-y-1">
                              {record.resume_analysis.projects.slice(0, 4).map((p, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                  <span className="text-emerald-400 mt-0.5 shrink-0">•</span>{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Score breakdown — sub-scores are 0-100 scale */}
                        {record.score_breakdown && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                              <BarChart3 className="w-3.5 h-3.5" /> Score Breakdown
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { label: "Skill Match",  val: record.score_breakdown.skill_match },
                                { label: "Experience",   val: record.score_breakdown.experience },
                                { label: "Projects",     val: record.score_breakdown.projects },
                                { label: "Diversity",    val: record.score_breakdown.diversity },
                              ].map(({ label, val }) => val != null && (
                                <div key={label} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all"
                                      style={{ width: `${Math.min(val, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                                    {val.toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                              {/* Final score pill */}
                              <div className="mt-2 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                <span className="text-xs font-semibold text-emerald-700">Final AI Score</span>
                                <span className="text-sm font-bold text-emerald-800">{record.score_breakdown.final_score}/100</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fairness breakdown — bias values are 0-20 scale (penalty points) */}
                        {record.fairness_breakdown && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-3">
                              ⚖️ Fairness Assessment
                              <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-100 font-bold text-blue-800">
                                {record.fairness_breakdown.fairness_score}/100
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { label: "Experience Bias", val: record.fairness_breakdown.experience_bias, max: 20 },
                                { label: "Education Bias",  val: record.fairness_breakdown.education_bias,  max: 15 },
                                { label: "Career Gap Bias", val: record.fairness_breakdown.career_gap_bias, max: 15 },
                              ].map(({ label, val, max }) => val != null && (
                                <div key={label} className="flex items-center gap-2">
                                  <span className="text-xs text-blue-600 w-28 shrink-0">{label}</span>
                                  <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${val === 0 ? "bg-emerald-400" : val <= 5 ? "bg-yellow-400" : "bg-red-400"}`}
                                      style={{ width: `${Math.min((val / max) * 100, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold w-16 text-right ${val === 0 ? "text-emerald-600" : val <= 5 ? "text-yellow-700" : "text-red-600"}`}>
                                    {val === 0 ? "None" : `${val} pts`}
                                  </span>
                                </div>
                              ))}
                              <p className="text-xs text-blue-500 mt-1">• Lower bias points = fairer evaluation. Max possible deduction: 50 pts.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Raw JSON toggle ───────────────────────────────────── */}
                  <button
                    onClick={() => setShowRaw(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Raw Blockchain Data (JSON)
                    </span>
                    {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <AnimatePresence>
                    {showRaw && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 relative">
                          <div className="absolute top-3 right-3">
                            <CopyButton text={JSON.stringify(onChain, null, 2)} />
                          </div>
                          <pre className="text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                            {JSON.stringify(onChain, null, 2)}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Trust note ────────────────────────────────────────── */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      <Lock className="w-3 h-3 inline text-emerald-500 mr-1" />
                      This record is stored on a tamper-proof blockchain. Third party including
                      <strong> TalentLens AI</strong> cannot modify it after submission.
                      {" "}Verification is performed locally in your browser using cryptographic hashing.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          {record && !loading && (
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ⛓ On-chain · block {onChain.block_number ?? "local"}
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

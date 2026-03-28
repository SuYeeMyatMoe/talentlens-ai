"""
TalentLens AI - Blockchain Verification Router
Provides trustless verification of on-chain hiring records.
Both candidates (own records) and admins can call these endpoints.
"""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Application, BlockchainLog, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain"])


@router.get("/verify/{application_id}")
async def verify_blockchain_record(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the on-chain record stored in BlockchainLog for a given application.
    Candidates can only fetch their own. Admins can fetch any.
    The frontend then independently recomputes the resume hash from the uploaded
    file/text and compares it to the stored resume_hash to prove trustlessness.
    """
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.user),
            selectinload(Application.resume),
            selectinload(Application.ranking),
            selectinload(Application.bias_report),
            selectinload(Application.blockchain_log),
        )
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Access control
    if current_user.role == "candidate" and app.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    log: BlockchainLog = app.blockchain_log
    if not log or not log.transaction_hash:
        raise HTTPException(
            status_code=404,
            detail="No blockchain record found. A decision must be made first."
        )

    # Recompute the expected resume hash so frontend can cross-check
    raw_text = app.resume.raw_text if app.resume else ""
    expected_resume_hash = hashlib.sha256(raw_text.encode()).hexdigest()

    return {
        "application_id": application_id,
        "candidate_name": app.user.name,
        "candidate_email": app.user.email,
        # ── On-chain stored values ──────────────────────────────────
        "on_chain": {
            "transaction_hash": log.transaction_hash,
            "resume_hash": log.resume_hash,          # stored on-chain
            "score": log.score,
            "fairness_score": log.fairness_score,
            "decision": log.decision,
            "network": log.network or "hardhat_local",
            "block_number": getattr(log, "block_number", None),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        },
        # ── Recomputed from DB for cross-check ─────────────────────
        "expected_resume_hash": "0x" + expected_resume_hash,
        "expected_score": app.ranking.final_score if app.ranking else None,
        "expected_fairness": app.bias_report.fairness_score if app.bias_report else None,
        "expected_decision": log.decision,
        "current_status": app.status,
        # ── Resume analysis data — shown after verification ─────────
        "resume_analysis": {
            "skills": app.resume.skills if app.resume else [],
            "experience_years": app.resume.experience_years if app.resume else None,
            "education": app.resume.education if app.resume else None,
            "projects": app.resume.projects if app.resume else [],
        } if app.resume else None,
        # ── Score breakdown ─────────────────────────────────────────
        "score_breakdown": {
            "final_score": round(app.ranking.final_score, 2) if app.ranking else None,
            "skill_match": round(app.ranking.skill_match_score, 2) if app.ranking else None,
            "experience": round(app.ranking.experience_score, 2) if app.ranking else None,
            "projects": round(app.ranking.project_score, 2) if app.ranking else None,
            "diversity": round(app.ranking.diversity_score, 2) if app.ranking else None,
            "fairness_factor": round(app.ranking.fairness_factor, 2) if app.ranking else None,
            "explanation": app.ranking.explanation if app.ranking else None,
        } if app.ranking else None,
        # ── Fairness breakdown ──────────────────────────────────────
        "fairness_breakdown": {
            "fairness_score": round(app.bias_report.fairness_score, 2) if app.bias_report else None,
            "experience_bias": round(app.bias_report.experience_bias, 2) if app.bias_report else None,
            "education_bias": round(app.bias_report.education_bias, 2) if app.bias_report else None,
            "career_gap_bias": round(app.bias_report.career_gap_bias, 2) if app.bias_report else None,
        } if app.bias_report else None,
    }

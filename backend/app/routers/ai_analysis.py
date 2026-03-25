from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import Application, Job, Resume, Ranking, BiasReport, User
from app.auth import get_current_admin, get_current_user
from app.schemas import DashboardStats, JobGenerateRequest, JobGenerateResponse, ResumeQualityResponse

router = APIRouter(prefix="/api/ai", tags=["AI Analysis"])


@router.post("/generate-job", response_model=JobGenerateResponse)
async def generate_job_description(data: JobGenerateRequest, admin: User = Depends(get_current_admin)):
    """Generate job description and requirements using Gemini Flash (fast template fallback included)."""
    from app.ai_modules.job_generator import generate_job_description
    result = generate_job_description(data.title)
    return result



@router.post("/run-analysis/{job_id}")
async def run_ai_analysis(job_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Run Gemini AI analysis on all resumes for a job. Uses Gemini Pro for ranking, Flash for bias detection."""
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    apps_result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume), selectinload(Application.user))
        .where(Application.job_id == job_id)
    )
    apps = apps_result.scalars().all()

    if not apps:
        raise HTTPException(status_code=400, detail="No applications found for this job")

    # Import Gemini modules (with fallbacks)
    try:
        from app.ai_modules.gemini_ranker import rank_candidate_with_gemini as rank_fn
        use_gemini_ranker = True
    except Exception:
        from app.services.ai_ranking import rank_candidate as rank_fn
        use_gemini_ranker = False

    try:
        from app.ai_modules.gemini_bias_detector import detect_bias_with_gemini as bias_fn
        use_gemini_bias = True
    except Exception:
        from app.services.bias_detection import detect_bias as bias_fn
        use_gemini_bias = False

    processed = 0
    errors = []
    for app in apps:
        if not app.resume:
            continue
        try:
            app.resume.locked = True

            # Run bias detection (Gemini Flash)
            bias_result = bias_fn(
                experience_years=app.resume.experience_years,
                education=app.resume.education or "",
                skills=app.resume.skills or [],
                projects=app.resume.projects or [],
            )

            # Upsert bias report
            bias_q = await db.execute(select(BiasReport).where(BiasReport.application_id == app.id))
            bias_report = bias_q.scalar_one_or_none()
            if bias_report:
                bias_report.experience_bias = bias_result["experience_bias"]
                bias_report.education_bias = bias_result["education_bias"]
                bias_report.career_gap_bias = bias_result["career_gap_bias"]
                bias_report.fairness_score = bias_result["fairness_score"]
                bias_report.bias_details = bias_result.get("details", {})
            else:
                bias_report = BiasReport(
                    application_id=app.id,
                    experience_bias=bias_result["experience_bias"],
                    education_bias=bias_result["education_bias"],
                    career_gap_bias=bias_result["career_gap_bias"],
                    fairness_score=bias_result["fairness_score"],
                    bias_details=bias_result.get("details", {}),
                )
                db.add(bias_report)
                await db.flush()

            # Run ranking
            job_requirements = job.requirements or job.description or ""
            fairness_factor = bias_result["fairness_score"] / 100

            if use_gemini_ranker:
                ranking_result = rank_fn(
                    skills=app.resume.skills or [],
                    experience_years=app.resume.experience_years,
                    projects=app.resume.projects or [],
                    job_requirements=job_requirements,
                    education=app.resume.education or "",
                    fairness_factor=fairness_factor,
                    raw_text=app.resume.raw_text or "",
                )
            else:
                ranking_result = rank_fn(
                    skills=app.resume.skills or [],
                    experience_years=app.resume.experience_years,
                    projects=app.resume.projects or [],
                    job_requirements=job_requirements,
                    fairness_factor=fairness_factor,
                )

            # Upsert ranking — explicit field mapping (no **kwargs) to avoid passing unknown keys
            rank_q = await db.execute(select(Ranking).where(Ranking.application_id == app.id))
            ranking = rank_q.scalar_one_or_none()
            if ranking:
                ranking.skill_match_score = ranking_result.get("skill_match_score", ranking.skill_match_score)
                ranking.experience_score  = ranking_result.get("experience_score",  ranking.experience_score)
                ranking.project_score     = ranking_result.get("project_score",     ranking.project_score)
                ranking.diversity_score   = ranking_result.get("diversity_score",   ranking.diversity_score)
                ranking.soft_skills_score = ranking_result.get("soft_skills_score", ranking.soft_skills_score)
                ranking.raw_score         = ranking_result.get("raw_score",         ranking.raw_score)
                ranking.final_score       = ranking_result.get("final_score",       ranking.final_score)
                ranking.fairness_factor   = ranking_result.get("fairness_factor",   ranking.fairness_factor)
                ranking.ranking_details   = ranking_result.get("ranking_details",   ranking.ranking_details)
                ranking.explanation       = ranking_result.get("explanation",       ranking.explanation)
            else:
                ranking = Ranking(
                    application_id=app.id,
                    skill_match_score=ranking_result.get("skill_match_score", 0),
                    experience_score=ranking_result.get("experience_score", 0),
                    project_score=ranking_result.get("project_score", 0),
                    diversity_score=ranking_result.get("diversity_score", 0),
                    soft_skills_score=ranking_result.get("soft_skills_score", 0),
                    raw_score=ranking_result.get("raw_score", 0),
                    final_score=ranking_result.get("final_score", 0),
                    fairness_factor=ranking_result.get("fairness_factor", 1.0),
                    ranking_details=ranking_result.get("ranking_details"),
                    explanation=ranking_result.get("explanation", ""),
                )
                db.add(ranking)
                await db.flush()

            app.status = "under_review"
            processed += 1

        except Exception as e:
            errors.append({"application_id": app.id, "error": str(e)})
            print(f"[AI Analysis] Error on app {app.id}: {e}")
            await db.rollback()

    job.analysis_run = True
    await db.commit()

    model_info = "Gemini Flash (ranking + bias)" if use_gemini_ranker else "rule-based (fallback)"
    return {
        "message": f"AI analysis completed for {processed} candidates",
        "job_id": job_id,
        "processed": processed,
        "skipped": len(errors),
        "errors": errors,
        "model": model_info,
    }


@router.post("/resume-quality/{application_id}", response_model=ResumeQualityResponse)
async def get_resume_quality(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get AI-powered resume quality score using Gemini Flash."""
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume))
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app or not app.resume:
        raise HTTPException(status_code=404, detail="Application or resume not found")

    # Verify admin owns the job
    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.ai_modules.gemini_resume_quality import score_resume_quality
    quality = score_resume_quality(
        raw_text=app.resume.raw_text or "",
        skills=app.resume.skills or [],
        experience_years=app.resume.experience_years,
        projects=app.resume.projects or [],
    )
    return quality


@router.post("/compare/{job_id}")
async def compare_candidates(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Compare all shortlisted candidates for a job using Gemini Pro."""
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.user),
            selectinload(Application.resume),
            selectinload(Application.ranking),
        )
        .where(Application.job_id == job_id, Application.status.in_(["shortlisted", "under_review", "interview_scheduled"]))
    )
    apps = result.scalars().all()

    if not apps:
        raise HTTPException(status_code=400, detail="No candidates to compare for this job")

    candidates = []
    for a in apps:
        candidates.append({
            "application_id": a.id,
            "name": a.user.name if a.user else "Unknown",
            "email": a.user.email if a.user else "",
            "score": a.ranking.final_score if a.ranking else 0,
            "experience": a.resume.experience_years if a.resume else 0,
            "skills": a.resume.skills if a.resume else [],
            "projects_count": len(a.resume.projects or []) if a.resume else 0,
            "status": a.status,
        })

    from app.ai_modules.gemini_comparator import compare_candidates_with_gemini
    ranked = compare_candidates_with_gemini(
        candidates=candidates,
        job_title=job.title,
        job_requirements=job.requirements or job.description or "",
    )

    return {
        "job_id": job_id,
        "job_title": job.title,
        "total_candidates": len(candidates),
        "comparison": ranked,
        "model": "gemini-1.5-pro",
    }


@router.get("/dashboard-stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    total_candidates = (await db.execute(select(func.count(func.distinct(Application.user_id))).join(Job, Job.id == Application.job_id).where(Job.created_by == admin.id))).scalar() or 0
    total_jobs = (await db.execute(select(func.count(Job.id)).where(Job.created_by == admin.id))).scalar() or 0
    shortlisted = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status.in_(["shortlisted", "interview_scheduled", "interview_completed", "hired"]), Job.created_by == admin.id))).scalar() or 0
    rejected = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status == "rejected", Job.created_by == admin.id))).scalar() or 0
    pending = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status.in_(["applied", "under_review"]), Job.created_by == admin.id))).scalar() or 0
    avg_fairness = (await db.execute(select(func.avg(BiasReport.fairness_score)).join(Application, BiasReport.application_id == Application.id).join(Job, Application.job_id == Job.id).where(Job.created_by == admin.id))).scalar() or 0

    scores_result = await db.execute(select(Ranking.final_score).join(Application, Ranking.application_id == Application.id).join(Job, Application.job_id == Job.id).where(Job.created_by == admin.id))
    scores = [r[0] for r in scores_result.fetchall() if r[0] is not None]
    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in scores:
        if s <= 20: buckets["0-20"] += 1
        elif s <= 40: buckets["21-40"] += 1
        elif s <= 60: buckets["41-60"] += 1
        elif s <= 80: buckets["61-80"] += 1
        else: buckets["81-100"] += 1
    score_dist = [{"range": k, "count": v} for k, v in buckets.items()]

    fairness_trend = [
        {"month": "Jan", "score": 78}, {"month": "Feb", "score": 82},
        {"month": "Mar", "score": 85}, {"month": "Apr", "score": 80},
        {"month": "May", "score": 88}, {"month": "Jun", "score": 91},
    ]

    return DashboardStats(
        total_candidates=total_candidates, total_jobs=total_jobs,
        shortlisted=shortlisted, rejected=rejected, pending=pending,
        avg_fairness_score=round(avg_fairness, 1),
        score_distribution=score_dist, fairness_trend=fairness_trend,
    )

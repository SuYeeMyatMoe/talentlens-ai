from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import Application, Job, Resume, Ranking, BiasReport, User
from app.auth import get_current_admin
from app.schemas import DashboardStats, JobGenerateRequest, JobGenerateResponse

router = APIRouter(prefix="/api/ai", tags=["AI Analysis"])


@router.post("/generate-job", response_model=JobGenerateResponse)
async def generate_job_description(data: JobGenerateRequest, admin: User = Depends(get_current_admin)):
    """Generate job description and requirements using AI based on job title."""
    title = data.title.lower()
    
    # Simple rule-based logic for the hackathon without needing a real LLM
    desc = f"We are looking for a highly skilled '{data.title}' to join our team. You will be responsible for designing, implementing, and maintaining scalable solutions. You will work closely with cross-functional teams to deliver high-quality products."
    
    reqs = "Requirements:\n"
    if "frontend" in title or "react" in title:
        reqs += "- 3+ years of experience with React, HTML, CSS, JavaScript\n- Experience with state management (Redux, Context API)\n- Knowledge of modern frontend build pipelines and tools\n- Strong UI/UX intuition"
    elif "backend" in title or "python" in title or "node" in title:
        reqs += "- 3+ years of experience with Backend development (Python, Node.js, etc.)\n- Experience with RESTful APIs and database design\n- Knowledge of SQL and NoSQL databases\n- Familiarity with cloud services (AWS, GCP)"
    elif "full stack" in title or "fullstack" in title:
        reqs += "- 4+ years of full stack web development experience\n- Strong proficiency in both frontend (React/Vue) and backend (Python/Node.js)\n- Experience with database architecture and deployment methodologies"
    elif "data" in title or "machine learning" in title or "ai" in title:
        reqs += "- Strong background in Data Science, Machine Learning, or AI\n- Proficiency in Python, Pandas, Numpy, Scikit-Learn\n- Experience with Deep Learning frameworks (TensorFlow, PyTorch)\n- Solid understanding of statistics and algorithms"
    else:
        reqs += f"- Proven experience as a {data.title} or similar role\n- Strong problem-solving and communication skills\n- Ability to work independently and collaboratively in a team\n- Relevant degree or equivalent practical experience"
        
    return {"description": desc, "requirements": reqs}


@router.post("/run-analysis/{job_id}")
async def run_ai_analysis(job_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Run AI analysis on all resumes for a job. Locks all resumes after running."""
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get all applications with resumes
    apps_result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume), selectinload(Application.user))
        .where(Application.job_id == job_id)
    )
    apps = apps_result.scalars().all()

    if not apps:
        raise HTTPException(status_code=400, detail="No applications found for this job")

    from app.services.ai_ranking import rank_candidate
    from app.services.bias_detection import detect_bias

    processed = 0
    for app in apps:
        if not app.resume:
            continue

        # Lock resume
        app.resume.locked = True

        # Run bias detection
        bias_result = detect_bias(
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
            bias_report.bias_details = bias_result["details"]
        else:
            bias_report = BiasReport(
                application_id=app.id,
                experience_bias=bias_result["experience_bias"],
                education_bias=bias_result["education_bias"],
                career_gap_bias=bias_result["career_gap_bias"],
                fairness_score=bias_result["fairness_score"],
                bias_details=bias_result["details"],
            )
            db.add(bias_report)

        # Run ranking
        job_requirements = job.requirements or job.description or ""
        ranking_result = rank_candidate(
            skills=app.resume.skills or [],
            experience_years=app.resume.experience_years,
            projects=app.resume.projects or [],
            job_requirements=job_requirements,
            fairness_factor=bias_result["fairness_score"] / 100,
        )

        # Upsert ranking
        rank_q = await db.execute(select(Ranking).where(Ranking.application_id == app.id))
        ranking = rank_q.scalar_one_or_none()
        if ranking:
            for k, v in ranking_result.items():
                if hasattr(ranking, k):
                    setattr(ranking, k, v)
        else:
            ranking = Ranking(application_id=app.id, **{k: v for k, v in ranking_result.items() if k != "explanation"})
            ranking.explanation = ranking_result.get("explanation", "")
            db.add(ranking)

        # Update application status to under_review
        app.status = "under_review"
        processed += 1

    # Mark job analysis as run
    job.analysis_run = True
    await db.commit()

    return {"message": f"AI analysis completed for {processed} candidates", "job_id": job_id, "processed": processed}


@router.get("/dashboard-stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    total_candidates = (await db.execute(select(func.count(func.distinct(Application.user_id))).join(Job, Job.id == Application.job_id).where(Job.created_by == admin.id))).scalar() or 0
    total_jobs = (await db.execute(select(func.count(Job.id)).where(Job.created_by == admin.id))).scalar() or 0
    shortlisted = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status == "shortlisted", Job.created_by == admin.id))).scalar() or 0
    rejected = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status == "rejected", Job.created_by == admin.id))).scalar() or 0
    pending = (await db.execute(select(func.count(Application.id)).join(Job, Job.id == Application.job_id).where(Application.status.in_(["applied", "under_review"]), Job.created_by == admin.id))).scalar() or 0
    avg_fairness = (await db.execute(select(func.avg(BiasReport.fairness_score)).join(Application, BiasReport.application_id == Application.id).join(Job, Application.job_id == Job.id).where(Job.created_by == admin.id))).scalar() or 0

    # Score distribution buckets for this admin's jobs
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

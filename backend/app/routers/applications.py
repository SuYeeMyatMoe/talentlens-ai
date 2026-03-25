import os
import hashlib
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import Application, Job, Resume, User, Notification, SkillEmbedding, Ranking, BiasReport, BlockchainLog
from app.schemas import ApplicationCreate, ApplicationResponse, CandidateDetailResponse, DecisionRequest
from app.auth import get_current_user, get_current_admin
from app.config import settings

router = APIRouter(prefix="/api/applications", tags=["Applications"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/", response_model=ApplicationResponse)
async def apply_to_job(data: ApplicationCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can apply")

    job_result = await db.execute(select(Job).where(Job.id == data.job_id, Job.published == True))
    if not job_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found or not published")

    existing = await db.execute(select(Application).where(
        Application.user_id == current_user.id,
        Application.job_id == data.job_id
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already applied to this job")

    app = Application(user_id=current_user.id, job_id=data.job_id)
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return ApplicationResponse(
        id=app.id, user_id=app.user_id, job_id=app.job_id,
        status=app.status, created_at=app.created_at,
        candidate_name=current_user.name, candidate_email=current_user.email
    )


@router.post("/{application_id}/upload-resume")
async def upload_resume(application_id: int, file: UploadFile = File(...),
                        db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Validate application ownership
    result = await db.execute(select(Application).where(
        Application.id == application_id, Application.user_id == current_user.id
    ))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Only block RE-uploads after analysis has run (prevents score gaming).
    # First-time uploads are always allowed so new candidates aren't locked out.
    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if job and job.analysis_run:
        existing_check = await db.execute(select(Resume).where(Resume.application_id == application_id))
        if existing_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Resume locked — AI analysis already run")

    if file.content_type not in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files allowed")

    # Save file
    ext = "pdf" if "pdf" in file.content_type else "docx"
    filename = f"resume_{application_id}_{current_user.id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    # Parse resume (import here to avoid circular)
    from app.services.resume_parser import parse_resume
    parsed = await parse_resume(filepath, file.content_type)

    # Upsert resume record
    existing_resume = await db.execute(select(Resume).where(Resume.application_id == application_id))
    resume = existing_resume.scalar_one_or_none()

    if resume:
        resume.skills = parsed["skills"]
        resume.experience_years = parsed["experience_years"]
        resume.projects = parsed["projects"]
        resume.education = parsed["education"]
        resume.raw_text = parsed.get("raw_text", "")
    else:
        resume = Resume(
            application_id=application_id,
            skills=parsed["skills"],
            experience_years=parsed["experience_years"],
            projects=parsed["projects"],
            education=parsed["education"],
            raw_text=parsed.get("raw_text", ""),
        )
        db.add(resume)
        await db.flush()

    # Update application resume_id
    app.resume_id = resume.id
    await db.commit()
    await db.refresh(resume)

    return {"message": "Resume uploaded and parsed", "resume_id": resume.id, "parsed": parsed}


@router.get("/my", response_model=List[ApplicationResponse])
async def my_applications(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume), selectinload(Application.ranking))
        .where(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    apps = result.scalars().all()
    return [ApplicationResponse(
        id=a.id, user_id=a.user_id, job_id=a.job_id, status=a.status,
        created_at=a.created_at, candidate_name=current_user.name,
        candidate_email=current_user.email,
        resume=a.resume, ranking=a.ranking if a.status in ["shortlisted", "rejected"] else None
    ) for a in apps]


@router.get("/job/{job_id}", response_model=List[CandidateDetailResponse])
async def get_job_candidates(job_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized to view candidates for this job")
        
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.user),
            selectinload(Application.resume),
            selectinload(Application.ranking),
            selectinload(Application.bias_report),
            selectinload(Application.blockchain_log),
        )
        .where(Application.job_id == job_id)
        .order_by(Application.created_at.desc())
    )
    apps = result.scalars().all()
    out = []
    for a in apps:
        out.append(CandidateDetailResponse(
            application_id=a.id,
            candidate_name=a.user.name,
            candidate_email=a.user.email,
            status=a.status,
            resume=a.resume,
            ranking=a.ranking,
            bias_report=a.bias_report,
            blockchain_verified=bool(a.blockchain_log and a.blockchain_log.transaction_hash),
            transaction_hash=a.blockchain_log.transaction_hash if a.blockchain_log else None,
        ))
    return out


@router.get("/{application_id}", response_model=CandidateDetailResponse)
async def get_candidate_detail(application_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
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

    # Candidates can only see their own
    if current_user.role == "candidate" and app.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Admins can only see applications for jobs they created
    if current_user.role == "admin":
        job_result = await db.execute(select(Job).where(Job.id == app.job_id))
        job = job_result.scalar_one_or_none()
        if not job or job.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied. You did not create this job.")

    decision_made = app.status in ["shortlisted", "rejected"]
    return CandidateDetailResponse(
        application_id=app.id,
        candidate_name=app.user.name,
        candidate_email=app.user.email,
        status=app.status,
        resume=app.resume,
        ranking=app.ranking if (current_user.role == "admin" or decision_made) else None,
        bias_report=app.bias_report if (current_user.role == "admin" or decision_made) else None,
        blockchain_verified=bool(app.blockchain_log and app.blockchain_log.transaction_hash),
        transaction_hash=app.blockchain_log.transaction_hash if app.blockchain_log else None,
        decision_visible=decision_made,
    )


@router.post("/{application_id}/decision")
async def make_decision(application_id: int, data: DecisionRequest,
                        db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.user), selectinload(Application.resume), selectinload(Application.ranking), selectinload(Application.bias_report))
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized. You did not create this job.")

    app.status = data.decision.value  # "shortlisted" or "rejected" — plain string

    # Notify candidate
    score = app.ranking.final_score if app.ranking else 0
    fairness = app.bias_report.fairness_score if app.bias_report else 100

    msg_map = {
        "shortlisted": ("🎉 Congratulations!", f"You have been shortlisted! Check your AI score and fairness report."),
        "rejected": ("Application Update", f"We have reviewed your application. Unfortunately, you were not selected at this time. AI Summary: Score {score:.1f}/100, Fairness {fairness:.1f}%."),
    }
    title, msg = msg_map[data.decision.value]
    notif = Notification(user_id=app.user_id, title=title, message=msg, type="decision" if data.decision.value == "shortlisted" else "info")
    db.add(notif)

    # Blockchain log
    from app.services.blockchain_service import log_decision
    resume_hash = hashlib.sha256((app.resume.raw_text or "").encode()).hexdigest() if app.resume else "0x0"
    score = app.ranking.final_score if app.ranking else 0
    fairness = app.bias_report.fairness_score if app.bias_report else 100
    tx = await log_decision(resume_hash, score, fairness, data.decision.value)

    existing_log = await db.execute(select(BlockchainLog).where(BlockchainLog.application_id == application_id))
    blog = existing_log.scalar_one_or_none()
    if blog:
        blog.decision = data.decision.value
        blog.transaction_hash = tx.get("transaction_hash")
        blog.resume_hash = resume_hash[:66]
        blog.score = score
        blog.fairness_score = fairness
    else:
        blog = BlockchainLog(
            application_id=application_id,
            resume_hash=resume_hash[:66],
            score=score,
            fairness_score=fairness,
            decision=data.decision.value,
            transaction_hash=tx.get("transaction_hash"),
            network="polygon_mumbai"
        )
        db.add(blog)

    await db.commit()
    return {"message": f"Decision '{data.decision.value}' recorded", "transaction_hash": tx.get("transaction_hash")}

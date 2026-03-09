import os
import aiofiles
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.database import get_db
from app.models import Job, Application, User, Resume
from app.schemas import JobCreate, JobUpdate, JobResponse
from app.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[JobResponse])
async def list_jobs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    else:
        result = await db.execute(select(Job).where(Job.published == True).order_by(Job.created_at.desc()))
    jobs = result.scalars().all()

    out = []
    for job in jobs:
        count_result = await db.execute(select(func.count(Application.id)).where(Application.job_id == job.id))
        job_data = JobResponse.model_validate(job)
        job_data.application_count = count_result.scalar() or 0
        out.append(job_data)
    return out


@router.post("/", response_model=JobResponse)
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    job = Job(**data.model_dump(), created_by=admin.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    job_data = JobResponse.model_validate(job)
    job_data.application_count = 0
    return job_data


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    count_result = await db.execute(select(func.count(Application.id)).where(Application.job_id == job_id))
    job_data = JobResponse.model_validate(job)
    job_data.application_count = count_result.scalar() or 0
    return job_data


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: int, data: JobUpdate, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(job, k, v)
    await db.commit()
    await db.refresh(job)
    return JobResponse.model_validate(job)


@router.delete("/{job_id}")
async def delete_job(job_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
    return {"message": "Job deleted"}


@router.post("/{job_id}/upload-resumes")
async def upload_resumes_bulk(job_id: int, files: List[UploadFile] = File(...), db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    from app.services.resume_parser import parse_resume
    
    successful = 0
    for file in files:
        if file.content_type not in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            continue
            
        name = file.filename.split('.')[0].replace('_', ' ')
        dummy_email = f"candidate_{uuid.uuid4().hex[:8]}@example.com"
        
        dummy_user = User(
            name=name.title()[:255],
            email=dummy_email,
            password_hash="import_dummy_hash",
            role="candidate"
        )
        db.add(dummy_user)
        await db.flush()
        
        app = Application(user_id=dummy_user.id, job_id=job_id)
        db.add(app)
        await db.flush()
        
        ext = "pdf" if "pdf" in file.content_type else "docx"
        filename = f"resume_{app.id}_{dummy_user.id}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        content = await file.read()
        async with aiofiles.open(filepath, "wb") as f:
            await f.write(content)
            
        parsed = await parse_resume(filepath, file.content_type)
        
        resume = Resume(
            application_id=app.id,
            skills=parsed["skills"],
            experience_years=parsed["experience_years"],
            projects=parsed["projects"],
            education=parsed["education"],
            raw_text=parsed.get("raw_text", ""),
        )
        db.add(resume)
        successful += 1
        
    await db.commit()
    return {"message": f"Successfully uploaded {successful} resumes for job {job_id}."}


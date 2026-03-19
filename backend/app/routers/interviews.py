"""
TalentLens AI - Interview Scheduling Router
Handles interview scheduling and candidate response notifications.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Application, Job, Interview, Notification, User
from app.auth import get_current_admin, get_current_user
from app.schemas import (
    InterviewSuggestRequest, InterviewScheduleRequest, InterviewResponse
)

router = APIRouter(prefix="/api/interviews", tags=["Interview Scheduling"])


@router.post("/suggest/{application_id}")
async def suggest_interview_slot(
    application_id: int,
    data: InterviewSuggestRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Step 1 (optional): Recruiter provides availability notes → Gemini Flash suggests interview slot.
    """
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.user), selectinload(Application.job))
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Verify admin owns the job
    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if app.status not in ["shortlisted", "under_review"]:
        raise HTTPException(
            status_code=400,
            detail=f"Candidate must be shortlisted before scheduling. Current status: {app.status}"
        )

    # Use Gemini Flash to suggest a slot
    from app.ai_modules.gemini_interview_scheduler import suggest_interview_slot as ai_suggest
    suggestion = ai_suggest(
        candidate_name=app.user.name if app.user else "Candidate",
        job_title=job.title,
        availability_notes=data.availability_notes or "",
        mode=data.mode,
    )

    return {
        "application_id": application_id,
        "candidate_name": app.user.name if app.user else "Unknown",
        "job_title": job.title,
        "suggestion": suggestion,
        "message": "AI has suggested an interview slot. Confirm to schedule.",
    }


@router.post("/schedule/{application_id}", response_model=InterviewResponse)
async def schedule_interview(
    application_id: int,
    data: InterviewScheduleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Recruiter confirms slot → Creates interview, sends email, updates status.
    Notification sent to candidate with just the title; candidate can expand for details.
    """
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.user),
            selectinload(Application.job),
            selectinload(Application.interview),
        )
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Generate meeting link for online interviews (Google Meet simulation)
    # Format: https://meet.google.com/xxx-yyyy-zzz  (3-4-3 lowercase letters)
    meeting_link = data.meeting_link
    if data.mode == "online" and not meeting_link:
        import random
        import string
        def _seg(n):
            return "".join(random.choices(string.ascii_lowercase, k=n))
        meeting_link = f"https://meet.google.com/{_seg(3)}-{_seg(4)}-{_seg(3)}"

    # Generate interview email content via Gemini Flash
    from app.ai_modules.gemini_email import generate_interview_email, send_email_smtp
    email_content = generate_interview_email(
        candidate_name=app.user.name if app.user else "Candidate",
        candidate_email=app.user.email if app.user else "",
        job_title=job.title,
        company_name="TalentLens",
        interview_date=data.scheduled_date,
        interview_time=data.scheduled_time,
        duration_minutes=data.duration_minutes,
        mode=data.mode,
        meeting_link=meeting_link or "",
        location=data.location or "",
        agenda="",
    )

    # Send email (or simulate)
    email_result = {"sent": False, "simulated": True}
    if app.user and app.user.email:
        email_result = send_email_smtp(
            to_email=app.user.email,
            subject=email_content["subject"],
            body=email_content["body"],
        )

    # Upsert Interview record
    existing = app.interview
    if existing:
        existing.scheduled_date = data.scheduled_date
        existing.scheduled_time = data.scheduled_time
        existing.duration_minutes = data.duration_minutes
        existing.mode = data.mode
        existing.meeting_link = meeting_link
        existing.location = data.location or ""
        existing.notes = data.notes or ""
        existing.status = "scheduled"
        existing.candidate_response = "pending"
        existing.email_sent = email_result.get("sent", False)
        existing.email_simulated = email_result.get("simulated", True)
        interview = existing
    else:
        interview = Interview(
            application_id=application_id,
            scheduled_date=data.scheduled_date,
            scheduled_time=data.scheduled_time,
            duration_minutes=data.duration_minutes,
            mode=data.mode,
            meeting_link=meeting_link,
            location=data.location or "",
            notes=data.notes or "",
            status="scheduled",
            candidate_response="pending",
            email_sent=email_result.get("sent", False),
            email_simulated=email_result.get("simulated", True),
        )
        db.add(interview)

    # Update application status
    app.status = "interview_scheduled"

    # Notify candidate — title only; candidate clicks "View Details" in the UI
    notif = Notification(
        user_id=app.user_id,
        application_id=application_id,
        title="📅 Interview Scheduled",
        message=(
            f"You have been invited for an interview for the position of '{job.title}'. "
            f"Click 'View Details' to see the schedule and meeting information, "
            f"and to accept or decline the invitation."
        ),
        type="success",
    )
    db.add(notif)

    await db.commit()
    await db.refresh(interview)

    return interview


@router.get("/{application_id}", response_model=InterviewResponse)
async def get_interview(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get interview details for an application."""
    result = await db.execute(
        select(Interview).where(Interview.application_id == application_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="No interview scheduled for this application")

    # Check access: candidate can only see their own, admin their jobs
    app_result = await db.execute(select(Application).where(Application.id == application_id))
    app = app_result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == "candidate" and app.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role == "admin":
        job_result = await db.execute(select(Job).where(Job.id == app.job_id))
        job = job_result.scalar_one_or_none()
        if not job or job.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return interview


@router.put("/{application_id}/respond")
async def candidate_respond(
    application_id: int,
    response: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Candidate accepts or declines the interview invitation.
    Sends a notification to the recruiter.
    """
    answer = response.get("response", "").lower()
    if answer not in ["accepted", "declined"]:
        raise HTTPException(status_code=400, detail="Response must be 'accepted' or 'declined'")

    # Load interview
    result = await db.execute(
        select(Interview).where(Interview.application_id == application_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Verify it belongs to this candidate
    app_result = await db.execute(
        select(Application)
        .options(selectinload(Application.job), selectinload(Application.user))
        .where(Application.id == application_id)
    )
    app = app_result.scalar_one_or_none()
    if not app or app.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update interview record
    interview.candidate_response = answer

    # Find the recruiter (job creator)
    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_name = current_user.name or "The candidate"
    job_title = job.title

    if answer == "accepted":
        recruiter_title = "✅ Interview Accepted"
        recruiter_msg = (
            f"{candidate_name} has accepted the interview invitation for '{job_title}' "
            f"scheduled on {interview.scheduled_date} at {interview.scheduled_time}."
        )
        notif_type = "success"
    else:
        recruiter_title = "❌ Interview Declined"
        recruiter_msg = (
            f"{candidate_name} has declined the interview invitation for '{job_title}' "
            f"scheduled on {interview.scheduled_date} at {interview.scheduled_time}. "
            f"You may want to reschedule."
        )
        notif_type = "warning"

    # Notify recruiter
    recruiter_notif = Notification(
        user_id=job.created_by,
        application_id=application_id,
        title=recruiter_title,
        message=recruiter_msg,
        type=notif_type,
    )
    db.add(recruiter_notif)

    await db.commit()
    await db.refresh(interview)

    return {
        "message": f"Interview {answer} successfully",
        "candidate_response": interview.candidate_response,
    }


@router.put("/{application_id}/complete")
async def complete_interview(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Mark interview as completed and update application status."""
    result = await db.execute(
        select(Interview).where(Interview.application_id == application_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    app_result = await db.execute(
        select(Application).options(selectinload(Application.user)).where(Application.id == application_id)
    )
    app = app_result.scalar_one_or_none()
    job_result = await db.execute(select(Job).where(Job.id == app.job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.created_by != admin.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    interview.status = "completed"
    app.status = "interview_completed"

    notif = Notification(
        user_id=app.user_id,
        application_id=application_id,
        title="✅ Interview Completed",
        message=f"Your interview for '{job.title}' has been marked as completed. The recruiter will be in touch soon.",
        type="info",
    )
    db.add(notif)
    await db.commit()

    return {"message": "Interview marked as completed", "application_id": application_id}

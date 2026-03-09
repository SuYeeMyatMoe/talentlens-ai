import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models import Application, User
from app.schemas import ApplicationResponse

async def main():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
        if not user:
            print("No candidate found")
            return
            
        result = await db.execute(
            select(Application)
            .options(selectinload(Application.resume), selectinload(Application.ranking))
            .where(Application.user_id == user.id)
            .order_by(Application.created_at.desc())
        )
        apps = result.scalars().all()
        
        for a in apps:
            try:
                resp = ApplicationResponse(
                    id=a.id, user_id=a.user_id, job_id=a.job_id, status=a.status,
                    created_at=a.created_at, candidate_name=user.name,
                    candidate_email=user.email,
                    resume=a.resume, ranking=a.ranking if a.status in ["shortlisted", "rejected"] else None
                )
                print(f"App {a.id} valid.")
            except Exception as e:
                import traceback
                print(f"Error on App {a.id}: {str(e)}")
                traceback.print_exc()

asyncio.run(main())

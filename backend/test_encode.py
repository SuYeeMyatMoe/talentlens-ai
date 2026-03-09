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
                resp = ApplicationResponse.model_validate(a)
                print(f"App {a.id} validated via model_validate")
            except Exception as e:
                import traceback
                print(f"Error on App {a.id} model_validate: {str(e)}")
                traceback.print_exc()

asyncio.run(main())

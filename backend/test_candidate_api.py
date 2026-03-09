import asyncio
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import User
from app.auth import create_access_token

async def get_token():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
        if not user: return None
        return create_access_token({"sub": str(user.id), "role": user.role})

async def main():
    token = await get_token()
    if not token:
        print("No candidate found")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r1 = await client.get("http://localhost:8001/api/jobs/", headers=headers)
        print("Jobs:", r1.status_code)
        if r1.status_code != 200: print(r1.text)
        
        r2 = await client.get("http://localhost:8001/api/applications/my", headers=headers)
        print("Apps:", r2.status_code)
        if r2.status_code != 200: print(r2.text)
        
        r3 = await client.get("http://localhost:8001/api/notifications/", headers=headers)
        print("Notifs:", r3.status_code)
        if r3.status_code != 200: print(r3.text)

try:
    asyncio.run(main())
except RuntimeError:
    pass

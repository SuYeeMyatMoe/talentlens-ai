import asyncio
import httpx
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User
from app.auth import create_access_token

async def main():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
        if not user:
            print("No candidate found")
            return
        token = create_access_token({"sub": str(user.id), "role": user.role})
    
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        r1 = await client.get("http://localhost:8001/api/jobs/", headers=headers)
        print("Jobs status:", r1.status_code)
        if r1.status_code != 200: print(r1.text)

        r2 = await client.get("http://localhost:8001/api/applications/my", headers=headers)
        print("Apps status:", r2.status_code)
        if r2.status_code != 200: print(r2.text)

        r3 = await client.get("http://localhost:8001/api/notifications/", headers=headers)
        print("Notifs status:", r3.status_code)
        if r3.status_code != 200: print(r3.text)

try:
    asyncio.run(main())
except RuntimeError:
    pass

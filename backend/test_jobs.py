import asyncio
import httpx

async def get_token():
    from app.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models import User
    from app.auth import create_access_token
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
        if not user: return None
        return create_access_token({"sub": str(user.id), "role": user.role})

async def main():
    token = await get_token()
    if not token: return
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8001/api/jobs/", headers=headers)
        print("Jobs JSON:", r.text)

try:
    asyncio.run(main())
except RuntimeError:
    pass

import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Assuming there is a candidate user. Alternatively list db.
        from app.database import AsyncSessionLocal
        from sqlalchemy import select
        from app.models import User
        
        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
            if not user:
                print("No candidate found")
                return
            
            # generate a token directly using auth
            from app.auth import create_access_token
            token = create_access_token({"sub": str(user.id), "role": user.role})
            
            headers = {"Authorization": f"Bearer {token}"}
            
            r1 = await client.get("http://localhost:8001/api/jobs/", headers=headers)
            print("Jobs:", r1.status_code, r1.text[:200])
            
            r2 = await client.get("http://localhost:8001/api/applications/my", headers=headers)
            print("My Apps:", r2.status_code, r2.text[:200])

            r3 = await client.get("http://localhost:8001/api/notifications/", headers=headers)
            print("Notifs:", r3.status_code, r3.text[:200])

asyncio.run(main())

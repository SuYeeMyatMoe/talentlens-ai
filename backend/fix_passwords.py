import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import User
from app.auth import hash_password

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for user in users:
            # We assume the default passwords are 'admin123' for admin and 'demo123' for candidate
            new_pass = "admin123" if user.role == "admin" else "demo123"
            user.password_hash = hash_password(new_pass)
            print(f"Updated password for {user.email}")
        await db.commit()

asyncio.run(main())

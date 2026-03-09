import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import User
from app.auth import verify_password
import app.routers.auth as auth_router
import traceback

async def main():
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.email == "admin@talentlens.ai"))
            user = result.scalar_one_or_none()
            if not user:
                print("User not found!")
                return
            print("Found user:", user.email, user.password_hash)
            is_valid = verify_password("admin123", user.password_hash)
            print("Password valid?", is_valid)
    except Exception as e:
        traceback.print_exc()

asyncio.run(main())

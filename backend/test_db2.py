import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(u.email, u.name, u.role)
        if not users:
            print("No users found.")

asyncio.run(main())

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def main():
    try:
        from app.routers.auth import login
        from app.schemas import UserLogin
        db_generator = get_db()
        db = await anext(db_generator)
        res = await login(UserLogin(email="admin@talentlens.ai", password="admin123"), db=db)
        print(res.json())
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())

import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import User
from app.auth import hash_password

async def seed():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == 'admin@talentlens.ai'))).scalar_one_or_none()
        if not user:
            print('Creating admin user...')
            admin = User(name='Admin Test', email='admin@talentlens.ai', password_hash=hash_password('admin123'), role='admin')
            db.add(admin)
            await db.commit()
            print('Admin created.')
        else:
            print('Admin already exists.')
            print("Role:", user.role)

if __name__ == "__main__":
    asyncio.run(seed())

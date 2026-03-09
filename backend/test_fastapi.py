import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import User
from app.auth import create_access_token

async def get_token():
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.role == "candidate"))).scalars().first()
        if not user: return None
        return create_access_token({"sub": str(user.id), "role": user.role})

token = asyncio.run(get_token())
if token:
    client = TestClient(app, raise_server_exceptions=True)
    try:
        response = client.get("/api/applications/my", headers={"Authorization": f"Bearer {token}"})
        print("Success:", response.json())
    except Exception as e:
        import traceback
        traceback.print_exc()

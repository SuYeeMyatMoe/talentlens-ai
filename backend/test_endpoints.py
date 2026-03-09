import requests
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

def get_candidate_email():
    import pymysql
    # parse db url 
    # e.g. mysql+aiomysql://root:password@localhost/talentlens
    url = settings.DATABASE_URL.replace("+aiomysql", "").replace("+pymysql", "")
    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    session = Session()
    from app.models import User
    user = session.query(User).filter_by(role="candidate").first()
    if user:
        return user.email
    return None

email = get_candidate_email()
if not email:
    print("No candidate found")
    exit()

print(f"Testing with candidate: {email}")

r_login = requests.post("http://localhost:8001/api/auth/login", json={"email":email,"password":"password"})
if r_login.status_code != 200:
    print("Login failed:", r_login.text)
    exit()

token = r_login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

r1 = requests.get("http://localhost:8001/api/jobs/", headers=headers)
print("Jobs:", r1.status_code)
if r1.status_code != 200: print(r1.text)

r2 = requests.get("http://localhost:8001/api/applications/my", headers=headers)
print("Apps:", r2.status_code)
if r2.status_code != 200: print(r2.text)

r3 = requests.get("http://localhost:8001/api/notifications/", headers=headers)
print("Notifs:", r3.status_code)
if r3.status_code != 200: print(r3.text)

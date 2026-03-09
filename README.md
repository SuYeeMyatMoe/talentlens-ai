# TalentLens AI 🚀

> AI-Powered Hiring Platform with Bias Detection & Blockchain Verification

Built for hackathon demo. White + Purple + Blue professional UI.

---

## 📁 Project Structure

```
talentlens-ai/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── config.py           # Environment settings
│   │   ├── database.py         # SQLAlchemy async DB
│   │   ├── models.py           # ORM models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── auth.py             # JWT auth utilities
│   │   ├── routers/
│   │   │   ├── auth.py         # /api/auth/*
│   │   │   ├── jobs.py         # /api/jobs/*
│   │   │   ├── applications.py # /api/applications/*
│   │   │   ├── ai_analysis.py  # /api/ai/*
│   │   │   └── notifications.py
│   │   └── services/
│   │       ├── resume_parser.py    # PDF/DOCX extraction
│   │       ├── ai_ranking.py       # Weighted scoring engine
│   │       ├── bias_detection.py   # Fairness scoring
│   │       └── blockchain_service.py
│   ├── requirements.txt
│   ├── Procfile                # Heroku deploy
│   └── .env.example
├── frontend/                   # React + Tailwind UI
│   ├── src/
│   │   ├── api/client.js       # Axios API client
│   │   ├── contexts/AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── CandidateDashboard.jsx
│   │   │   ├── RecruiterDashboard.jsx
│   │   │   ├── CandidateRanking.jsx
│   │   │   ├── CandidateDetail.jsx
│   │   │   ├── JobDetail.jsx
│   │   │   └── CreateJob.jsx
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       └── ScoreCircle.jsx
│   ├── package.json
│   └── tailwind.config.js
├── smart_contracts/
│   ├── TalentLensHiring.sol    # Solidity contract
│   └── deploy.py               # Polygon deployment
├── database/
│   └── schema.sql              # MySQL schema
├── synthetic_data/
│   └── generate_data.py        # 1000 test candidates
└── README.md
```

---

## ⚡ Quick Setup (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL 8+

---

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p < database/schema.sql
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
"C:/Users/hp/AppData/Local/Programs/Python/Python310/python.exe" -m venv venv310
source venv310/Scripts/activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Copy and configure environment
cp .env.example .env
# Edit .env with your DB credentials

# Start backend
venv310/Scripts/python -m uvicorn app.main:app --reload --port 8001


```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start frontend
npm run dev
```

Frontend runs at: http://localhost:5173

---

### 4. Generate Test Data (Optional)

```bash
# From project root
pip install faker
python synthetic_data/generate_data.py

# Load first 100 candidates into DB
mysql -u root -p talentlens < synthetic_data/seed.sql
```

---

## 🔑 Default Admin Account

After running schema.sql, a default admin is created:
- Email: `admin@talentlens.ai`
- Password: `admin123`

> ⚠️ Change this in production!

---

## 🌐 Demo Workflow

### As Recruiter (Admin):
1. Login with admin credentials
2. Create a job with requirements
3. Publish the job
4. Wait for candidates to apply
5. Click **"Run AI Analysis"** on the job
6. View ranked candidates table
7. Click a candidate → See AI score, fairness, radar chart
8. Click **Shortlist** or **Reject**
9. Blockchain record auto-created
10. Candidate receives notification

### As Candidate:
1. Register new account
2. Browse published jobs
3. Click Apply
4. Upload PDF/DOCX resume
5. Wait for recruiter to run analysis and decide
6. Receive notification
7. View AI breakdown and fairness score

---

## 🚀 Deployment

### Backend → Heroku

```bash
cd backend

heroku login
heroku create talentlens-ai-backend
heroku addons:create cleardb:ignite  # MySQL

# Set environment variables
heroku config:set SECRET_KEY=your-secret-key-here
heroku config:set DATABASE_URL=$(heroku config:get CLEARDB_DATABASE_URL)
heroku config:set CORS_ORIGINS=https://your-frontend.vercel.app

git add . && git commit -m "Deploy TalentLens AI"
git push heroku main
```

### Frontend → Vercel

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Set environment variable
echo "VITE_API_URL=https://talentlens-ai-backend.herokuapp.com" > .env.production

# Deploy
vercel --prod
```

---

## ⛓️ Blockchain Deployment (Polygon Mumbai)

```bash
# Get test MATIC from: https://faucet.polygon.technology

cd smart_contracts
pip install web3 py-solc-x

PRIVATE_KEY=0x... POLYGON_RPC=https://rpc-mumbai.maticvigil.com python deploy.py

# Update backend .env with:
# CONTRACT_ADDRESS=<deployed address>
# PRIVATE_KEY=<your private key>
```

---

## 🤖 AI Scoring Formula

```
Skill Match Score   = 40%   (semantic keyword overlap with job requirements)
Experience Score    = 25%   (logarithmic curve: 0yr→10, 10yr→95)
Project Score       = 20%   (count + impact keyword detection)
Skill Diversity     = 10%   (breadth across 7 tech categories)
Soft Skills Score   =  5%   (leadership, agile, communication)

Raw Score = weighted sum of above
Final Score = Raw Score × Fairness Factor (0.6–1.0)
```

---

## 🛡️ Bias Detection

Three bias dimensions detected:
- **Experience Bias** (0–20 pts penalty): Entry-level candidates
- **Education Bias** (0–15 pts): Non-traditional paths
- **Career Gap Bias** (0–15 pts): High projects, low formal experience

`FairnessScore = 100 - weighted_bias (floor: 60%)`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/jobs/ | List jobs |
| POST | /api/jobs/ | Create job (admin) |
| POST | /api/applications/ | Apply to job |
| POST | /api/applications/{id}/upload-resume | Upload resume |
| GET | /api/applications/job/{job_id} | Get candidates (admin) |
| GET | /api/applications/{id} | Get detail |
| POST | /api/applications/{id}/decision | Shortlist/Reject |
| POST | /api/ai/run-analysis/{job_id} | Run AI (admin) |
| GET | /api/ai/dashboard-stats | Analytics stats |
| GET | /api/notifications/ | Get notifications |

Full Swagger docs: `http://localhost:8000/docs`

---

## 🎨 UI Color Scheme

- **Primary**: Purple `#7c3aed` (Tailwind `primary-600`)
- **Secondary**: Blue `#2563eb` (Tailwind `blue-600`)
- **Background**: White `#ffffff`
- **Surface**: Light gray `#f9fafb`
- **Font Display**: Sora
- **Font Body**: DM Sans

---

Built with ❤️ for the hackathon.

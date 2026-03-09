from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    candidate = "candidate"
    admin = "admin"


class ApplicationStatus(str, Enum):
    applied = "applied"
    under_review = "under_review"
    shortlisted = "shortlisted"
    rejected = "rejected"


class DecisionType(str, Enum):
    shortlisted = "shortlisted"
    rejected = "rejected"


# ─── Auth Schemas ──────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.candidate


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ─── Job Schemas ───────────────────────────────────────────────────────────────
class JobCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    requirements: Optional[str] = None
    deadline: Optional[date] = None
    published: bool = False


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    deadline: Optional[date] = None
    published: Optional[bool] = None


class JobGenerateRequest(BaseModel):
    title: str


class JobGenerateResponse(BaseModel):
    description: str
    requirements: str


class JobResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    requirements: Optional[str]
    deadline: Optional[date]
    published: bool
    analysis_run: bool
    created_by: int
    created_at: datetime
    application_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── Application Schemas ───────────────────────────────────────────────────────
class ApplicationCreate(BaseModel):
    job_id: int


class ResumeResponse(BaseModel):
    id: int
    application_id: int
    skills: Optional[List[str]] = []
    experience_years: float = 0
    projects: Optional[List[str]] = []
    education: Optional[str] = None
    locked: bool

    class Config:
        from_attributes = True

class ResumeUpdate(BaseModel):
    skills: Optional[List[str]] = None
    experience_years: Optional[float] = None
    projects: Optional[List[str]] = None
    education: Optional[str] = None

class RankingResponse(BaseModel):
    id: int
    application_id: int
    skill_match_score: float
    experience_score: float
    project_score: float
    diversity_score: float
    soft_skills_score: float
    raw_score: float
    final_score: float
    fairness_factor: float
    ranking_details: Optional[Any] = None
    explanation: Optional[str] = None

    class Config:
        from_attributes = True

class ApplicationResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    status: ApplicationStatus
    created_at: datetime
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    resume: Optional[ResumeResponse] = None
    ranking: Optional[RankingResponse] = None

    class Config:
        from_attributes = True

# ─── Bias Report Schemas ────────────────────────────────────────────────────────
class BiasReportResponse(BaseModel):
    id: int
    application_id: int
    experience_bias: float
    education_bias: float
    career_gap_bias: float
    fairness_score: float
    bias_details: Optional[Any] = None

    class Config:
        from_attributes = True


# ─── Candidate Detail Schema ───────────────────────────────────────────────────
class CandidateDetailResponse(BaseModel):
    application_id: int
    candidate_name: str
    candidate_email: str
    status: ApplicationStatus
    resume: Optional[ResumeResponse] = None
    ranking: Optional[RankingResponse] = None
    bias_report: Optional[BiasReportResponse] = None
    blockchain_verified: bool = False
    transaction_hash: Optional[str] = None
    decision_visible: bool = True


# ─── Decision Schema ───────────────────────────────────────────────────────────
class DecisionRequest(BaseModel):
    decision: DecisionType


# ─── Blockchain Schemas ────────────────────────────────────────────────────────
class BlockchainLogResponse(BaseModel):
    id: int
    application_id: int
    resume_hash: Optional[str]
    score: Optional[float]
    fairness_score: Optional[float]
    decision: Optional[str]
    transaction_hash: Optional[str]
    network: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Notification Schemas ──────────────────────────────────────────────────────
class NotificationResponse(BaseModel):
    id: int
    title: Optional[str]
    message: Optional[str]
    type: str
    read_status: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard Analytics Schemas ──────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_candidates: int
    total_jobs: int
    shortlisted: int
    rejected: int
    pending: int
    avg_fairness_score: float
    score_distribution: List[Any]
    fairness_trend: List[Any]

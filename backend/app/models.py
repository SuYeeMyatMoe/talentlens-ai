from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, Date, Enum, ForeignKey, UniqueConstraint, BigInteger, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    candidate = "candidate"
    admin = "admin"


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    under_review = "under_review"
    shortlisted = "shortlisted"
    rejected = "rejected"


class NotificationType(str, enum.Enum):
    info = "info"
    success = "success"
    warning = "warning"
    decision = "decision"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.candidate)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    applications = relationship("Application", back_populates="user")
    jobs_created = relationship("Job", back_populates="creator")
    notifications = relationship("Notification", back_populates="user")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    requirements = Column(Text)
    deadline = Column(Date)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    published = Column(Boolean, default=False)
    analysis_run = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User", back_populates="jobs_created")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.applied)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "job_id", name="unique_application"),)

    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    resume = relationship("Resume", back_populates="application", uselist=False)
    ranking = relationship("Ranking", back_populates="application", uselist=False)
    bias_report = relationship("BiasReport", back_populates="application", uselist=False)
    blockchain_log = relationship("BlockchainLog", back_populates="application", uselist=False)


class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    skills = Column(JSON, default=list)
    experience_years = Column(Float, default=0)
    projects = Column(JSON, default=list)
    education = Column(String(500))
    raw_text = Column(Text)
    locked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    application = relationship("Application", foreign_keys=[application_id], back_populates="resume")
    skill_embeddings = relationship("SkillEmbedding", back_populates="resume", cascade="all, delete-orphan")


class SkillEmbedding(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    skill_name = Column(String(255), nullable=False)
    embedding_vector = Column(JSON)

    resume = relationship("Resume", back_populates="skill_embeddings")


class Ranking(Base):
    __tablename__ = "rankings"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    skill_match_score = Column(Float, default=0)
    experience_score = Column(Float, default=0)
    project_score = Column(Float, default=0)
    diversity_score = Column(Float, default=0)
    soft_skills_score = Column(Float, default=0)
    raw_score = Column(Float, default=0)
    final_score = Column(Float, default=0)
    fairness_factor = Column(Float, default=1.0)
    ranking_details = Column(JSON)
    explanation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="ranking")


class BiasReport(Base):
    __tablename__ = "bias_reports"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    experience_bias = Column(Float, default=0)
    education_bias = Column(Float, default=0)
    career_gap_bias = Column(Float, default=0)
    fairness_score = Column(Float, default=100)
    bias_details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="bias_report")


class BlockchainLog(Base):
    __tablename__ = "blockchain_logs"
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    resume_hash = Column(String(66))
    score = Column(Float)
    fairness_score = Column(Float)
    decision = Column(String(50))
    transaction_hash = Column(String(66))
    block_number = Column(BigInteger)
    network = Column(String(50), default="polygon_mumbai")
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="blockchain_log")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255))
    message = Column(Text)
    type = Column(Enum(NotificationType), default=NotificationType.info)
    read_status = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")

"""
LearnVault — ORM Models + Cryptographic Hashing
"""

import hashlib
import os
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from database import Base

# ═══════════════════════════════════════════════
#  Secret key for hash sealing
# ═══════════════════════════════════════════════

SECRET_KEY = os.environ.get("LEARNVAULT_SECRET_KEY", "dev-secret-change-in-production")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════
#  Cryptographic Hash Utility
# ═══════════════════════════════════════════════

def generate_hash(user_id: int, score: int, secret_key: str) -> str:
    """
    Produce a SHA-256 HMAC-style hash that seals a submission record.
    Any tampering with user_id or score will invalidate the hash.
    """
    payload = f"{user_id}:{score}:{secret_key}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ═══════════════════════════════════════════════
#  ORM Models
# ═══════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(64), nullable=False)
    role = Column(String(20), nullable=False, default="student")
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("StudentProgress", back_populates="user", cascade="all, delete-orphan")
    tokens = relationship("SupportToken", back_populates="user", cascade="all, delete-orphan")
    received_messages = relationship("StudentMessage", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    author = Column(String(200), nullable=False, default="LearnVault")
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    tests = relationship("Test", back_populates="course", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="course")
    progress = relationship("StudentProgress", back_populates="course")


class Module(Base):
    """A module represents a content unit (video, text file) within a course."""
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content_type = Column(String(20), nullable=False, default="video")  # video, text
    url = Column(String(500), nullable=True)       # for video URLs or uploaded file paths
    file_path = Column(String(500), nullable=True)  # for uploaded files (text/video)
    order = Column(Integer, nullable=False, default=0)

    course = relationship("Course", back_populates="modules")


class Test(Base):
    """A time-bound test linked to a course, unlocked after modules are completed."""
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    time_limit_minutes = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    course = relationship("Course", back_populates="tests")
    questions = relationship("TestQuestion", back_populates="test", cascade="all, delete-orphan")


class TestQuestion(Base):
    """Question within a test — MCQ or written."""
    __tablename__ = "test_questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, index=True)
    question_type = Column(String(20), nullable=False, default="mcq")  # mcq, written
    question = Column(Text, nullable=False)
    option_a = Column(String(300), nullable=True)
    option_b = Column(String(300), nullable=True)
    option_c = Column(String(300), nullable=True)
    option_d = Column(String(300), nullable=True)
    correct_option = Column(Integer, nullable=True)  # 0=A,1=B,2=C,3=D (null for written)
    marks = Column(Integer, nullable=False, default=1)

    test = relationship("Test", back_populates="questions")


class StudentProgress(Base):
    """Tracks which modules a student has completed in a course."""
    __tablename__ = "student_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    completed = Column(Boolean, default=True, nullable=False)
    completed_at = Column(DateTime, default=_utcnow, nullable=False)

    user = relationship("User", back_populates="progress")
    course = relationship("Course", back_populates="progress")


class Submission(Base):
    """
    Immutable quiz/test submission record.
    record_hash is computed automatically before insert to seal the row.
    """
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True, index=True)
    score = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    percentage = Column(Float, nullable=False)
    attempt_number = Column(Integer, nullable=False, default=1)
    record_hash = Column(String(64), nullable=False)
    submitted_at = Column(DateTime, default=_utcnow, nullable=False)

    user = relationship("User", back_populates="submissions")
    course = relationship("Course", back_populates="submissions")


class SupportToken(Base):
    """Student-raised query/problem ticket for admin to review."""
    __tablename__ = "support_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open, in_progress, closed
    admin_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    user = relationship("User", back_populates="tokens")


class StudentMessage(Base):
    """Personal message from admin to a specific student (alert)."""
    __tablename__ = "student_messages"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    student = relationship("User", back_populates="received_messages")


class Enrollment(Base):
    """Tracks which courses a student has enrolled in."""
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    enrolled_at = Column(DateTime, default=_utcnow, nullable=False)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course")


class Certificate(Base):
    """Certificate earned after completing a course test."""
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    score_percentage = Column(Float, nullable=False)
    file_path = Column(String(500), nullable=False)
    issued_at = Column(DateTime, default=_utcnow, nullable=False)

    user = relationship("User", back_populates="certificates")
    course = relationship("Course")


# ═══════════════════════════════════════════════
#  Before-Insert Trigger — Seal submission with hash
# ═══════════════════════════════════════════════

@event.listens_for(Submission, "before_insert")
def seal_submission(mapper, connection, target):
    """Automatically compute record_hash before a Submission is persisted."""
    target.record_hash = generate_hash(
        user_id=target.user_id,
        score=target.score,
        secret_key=SECRET_KEY,
    )

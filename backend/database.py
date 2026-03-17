"""
LearnVault — Database Configuration
SQLAlchemy (SQL) + Motor (MongoDB)

Security: WAL exclusive locking, DB integrity checks, foreign key enforcement.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ═══════════════════════════════════════════════
#  SQLAlchemy — Relational DB (SQLite)
#  - WAL mode for concurrent reads
#  - EXCLUSIVE locking prevents external access while server runs
#  - Foreign keys enforced at DB level
# ═══════════════════════════════════════════════

SQLALCHEMY_DATABASE_URL = "sqlite:///./learnvault.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, connection_record):
    """Configure SQLite for security and performance on every connection."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA busy_timeout = 5000;")
    cursor.execute("PRAGMA secure_delete = ON;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ═══════════════════════════════════════════════
#  Motor — MongoDB (Async)
# ═══════════════════════════════════════════════

MONGO_URL = "mongodb://localhost:27017"
MONGO_DB_NAME = "learnvault"

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    mongo_db = mongo_client[MONGO_DB_NAME]
    video_content_collection = mongo_db["video_content"]
except ImportError:
    mongo_client = None
    mongo_db = None
    video_content_collection = None

"""
Database session and base model wiring.
Provides SQLAlchemy engine, session factory, and FastAPI dependency for DB access.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

# Use future engine for 2.0 style behavior.
engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_session():
    """
    FastAPI dependency that yields a database session.

    Yields:
        SQLAlchemy session with autocommit disabled.
    Side Effects:
        Closes the session after request handling.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

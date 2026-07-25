from __future__ import annotations
import os
from contextlib import contextmanager
from collections.abc import Iterator
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg://vitalych:vitalych@127.0.0.1:5432/vitalych"

_engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None

def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

def get_engine() -> Engine:
    global _engine, SessionLocal
    if _engine is None:
        _engine = create_engine(database_url(), pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine

@contextmanager
def get_session() -> Iterator[Session]:
    get_engine()
    assert SessionLocal is not None
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

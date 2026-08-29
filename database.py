import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./bioeye.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Instantiate database structures cleanly
def init_db():
    Base.metadata.create_all(bind=engine)

# Dependency injection provider for FastAPI router paths
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
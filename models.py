import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base, engine

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship to link records to this user
    records = relationship("AnalysisRecord", back_populates="owner")

class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    success = Column(Boolean, default=True)
    analysis_output = Column(Text, nullable=True)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # New: Relational linkage back to the users table
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable for now so old rows don't break
    owner = relationship("User", back_populates="records")

def init_db():
    Base.metadata.create_all(bind=engine)
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    firstname= Column(String, nullable=True)
    lastname = Column(String, nullable=True)
    
    contacts = relationship("EmergencyContact", back_populates="user", cascade="all, delete-orphan")

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, nullable=False)

    user = relationship("User", back_populates="contacts")

from datetime import datetime
from sqlalchemy import Float, DateTime

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, nullable=False) # 'fire' or 'warn'
    location = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    confidence = Column(Float, nullable=True)
    coords = Column(String, nullable=True)

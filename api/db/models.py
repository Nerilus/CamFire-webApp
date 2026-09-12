from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Float, DateTime
from sqlalchemy.orm import relationship
from db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    firstname = Column(String, nullable=True)
    lastname = Column(String, nullable=True)
    
    # Sécurité & Double Authentification (2FA)
    is_2fa_enabled = Column(Boolean, default=True, nullable=False)
    otp_code_hash = Column(String, nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=False)

    # Réinitialisation de mot de passe (Forgot Password)
    reset_code = Column(String, nullable=True)
    reset_code_expires_at = Column(DateTime, nullable=True)

    # Alertes e-mail d'urgence (Détection d'incendie avec photo)
    emergency_alert_email = Column(String, nullable=True)
    emergency_alerts_enabled = Column(Boolean, default=True, nullable=False)

    contacts = relationship("EmergencyContact", back_populates="user", cascade="all, delete-orphan")
    user_devices = relationship("UserDevice", back_populates="user", cascade="all, delete-orphan")
    sites = relationship("Site", back_populates="user", cascade="all, delete-orphan")

    @property
    def devices(self):
        result = []
        now = datetime.utcnow()
        for ud in self.user_devices:
            dev = ud.device
            is_recent = dev.last_seen_at and (now - dev.last_seen_at).total_seconds() < 45
            status_val = "online" if is_recent else "offline"
            if dev.tamper_status == "tampered":
                status_val = "tampered"
            result.append({
                "id": dev.id,
                "device_id": dev.device_id,
                "name": ud.custom_name or dev.name,
                "role": ud.role or "owner",
                "is_paired": True,
                "paired_at": ud.paired_at,
                "last_seen_at": dev.last_seen_at,
                "lat": dev.lat,
                "lng": dev.lng,
                "status": status_val,
                "tamper_status": dev.tamper_status or "normal",
                "cpu_temp": dev.cpu_temp
            })
        return result

class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    custom_name = Column(String, nullable=True)
    role = Column(String, default="owner", nullable=False) # 'owner' ou 'member'
    paired_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="user_devices")
    device = relationship("Device", back_populates="user_devices")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, default="Raspberry 4")
    hashed_pairing_code = Column(String, nullable=False)
    stream_url = Column(String, nullable=False, default="https://safely-virgin-mistress-staying.trycloudflare.com/stream.mjpg")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    is_paired = Column(Boolean, default=False, nullable=False)
    paired_at = Column(DateTime, nullable=True)
    code_expires_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    tamper_status = Column(String, default="normal", nullable=True) # 'normal', 'tampered', 'signal_lost'
    cpu_temp = Column(Float, nullable=True)
    last_tamper_alert_at = Column(DateTime, nullable=True)
    lat = Column(Float, default=46.2276, nullable=True)
    lng = Column(Float, default=2.2137, nullable=True)

    user_devices = relationship("UserDevice", back_populates="device", cascade="all, delete-orphan")
    sites = relationship("Site", back_populates="device")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    lat = Column(Float, nullable=False, default=46.2276)
    lng = Column(Float, nullable=False, default=2.2137)
    radius = Column(Float, nullable=False, default=300.0) # Rayon de surveillance en mètres
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sites")
    device = relationship("Device", back_populates="sites")

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False)

    user = relationship("User", back_populates="contacts")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, nullable=False) # 'fire' or 'warn'
    location = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    confidence = Column(Float, nullable=True)
    coords = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    detection_type = Column(String, nullable=True, default="fire") # 'fire', 'person', 'manual'

class Capture(Base):
    __tablename__ = "captures"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    detection_type = Column(String, nullable=False, default="person") # "person", "fire", "manual"
    status = Column(String, nullable=False, default="warn") # "warn", "fire", "safe"
    confidence = Column(Float, nullable=True)
    location = Column(String, nullable=True, default="Raspberry 4")
    image_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    client_name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device")


from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "Verification Officer"
    organization: Optional[str] = "Apex Bank BFSI"


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: Optional[str] = None
    organization: Optional[str] = None
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    status: str
    message: str
    token: str
    user: UserResponse


UserRegister = UserRegisterRequest
UserLogin = UserLoginRequest


class SessionCreate(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = Field(default="Pending Identification", max_length=120)
    app_no: Optional[str] = Field(default=None, max_length=60)
    channel: Optional[str] = Field(default="Automated Voice Agent", max_length=60)
    status: Optional[str] = Field(default="In Progress", max_length=30)
    entity_count: Optional[int] = Field(default=8, ge=1, le=20)


class SessionUpdate(BaseModel):
    status: Optional[str] = Field(default=None, max_length=30)
    initial_conf: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    final_conf: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    corrections: Optional[int] = Field(default=None, ge=0)
    duration_secs: Optional[int] = Field(default=None, ge=0)
    dialogue_log: Optional[List[Dict[str, Any]]] = None
    active_target_id: Optional[str] = Field(default=None, max_length=40)
    verification_summary: Optional[str] = Field(default=None, max_length=1500)


class EntityUpdate(BaseModel):
    value: Optional[str] = Field(default=None, max_length=500)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    status: Optional[str] = Field(default=None, max_length=30)
    validation_status: Optional[str] = Field(default=None, max_length=30)
    validation_message: Optional[str] = Field(default=None, max_length=300)
    verified_at: Optional[str] = Field(default=None, max_length=60)


class ExtractRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    acoustic_confidence: float = Field(default=90.0, ge=0.0, le=100.0)
    target_entity_id: Optional[str] = Field(default=None, max_length=40)


class ConfirmRequest(BaseModel):
    session_id: str = Field(..., min_length=3, max_length=80)
    entity_id: str = Field(..., min_length=1, max_length=80)
    entity_type: str = Field(..., min_length=1, max_length=40)
    confirmed_value: str = Field(..., min_length=1, max_length=500)
    confidence: float = Field(default=95.0, ge=0.0, le=100.0)


class CorrectRequest(BaseModel):
    session_id: str = Field(..., min_length=3, max_length=80)
    entity_id: str = Field(..., min_length=1, max_length=80)
    entity_type: str = Field(..., min_length=1, max_length=40)
    original_value: str = Field(default="", max_length=500)
    corrected_value: str = Field(..., min_length=1, max_length=500)
    original_conf: float = Field(default=75.0, ge=0.0, le=100.0)
    corrected_conf: float = Field(default=95.0, ge=0.0, le=100.0)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1500)
    voice: Optional[str] = Field(default=None, max_length=40)
    model: Optional[str] = Field(default=None, max_length=40)
    language: Optional[str] = Field(default=None, max_length=20)
    speed: float = Field(default=1.0, ge=0.85, le=1.15)


class DialogueRequest(BaseModel):
    text: str = Field(..., max_length=4000)
    session_id: Optional[str] = Field(default=None, max_length=80)
    active_target_id: Optional[str] = Field(default=None, max_length=40)
    entities: Optional[Dict[str, Any]] = None
    acoustic_confidence: float = Field(default=92.0, ge=0.0, le=100.0)

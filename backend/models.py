from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class PhoneticItem(BaseModel):
    char: str
    code: str

class EntityModel(BaseModel):
    id: str
    label: str
    value: str
    type: str # 'alpha', 'numeric', 'address', 'date', 'alphanumeric'
    confidence: float
    status: str = "pending" # 'verified', 'pending', 'flagged', 'corrected'
    history: List[str] = Field(default_factory=list)
    phoneticSummary: str = ""
    phoneticDetails: List[PhoneticItem] = Field(default_factory=list)
    validationStatus: str = "valid" # 'valid', 'warning', 'invalid'
    validationMessage: str = ""
    verifiedAt: Optional[str] = None

class ExtractionRequest(BaseModel):
    text: str
    session_id: Optional[str] = None
    acoustic_confidence: Optional[float] = 92.0
    active_target_id: Optional[str] = None

class ValidationRequest(BaseModel):
    entity_type: str
    value: str

class ValidationResponse(BaseModel):
    is_valid: bool
    status: str # 'valid', 'warning', 'invalid'
    message: str
    normalized_value: str
    confidence_modifier: float # e.g. -15.0 if incomplete

class ConfirmationRequest(BaseModel):
    session_id: str
    entity_id: str
    entity_type: str
    confirmed_value: str
    confidence: Optional[float] = 96.0

class CorrectionRequest(BaseModel):
    session_id: str
    entity_id: str
    entity_type: str
    original_value: str
    corrected_value: str
    original_confidence: Optional[float] = 75.0

class SessionCreateRequest(BaseModel):
    customer_id: Optional[str] = "CUST-8021"
    customer_name: Optional[str] = "Rahul Sharma"
    app_no: Optional[str] = "LOAN-2025-881"
    channel: Optional[str] = "Inbound IVR"

class SessionUpdateRequest(BaseModel):
    status: Optional[str] = None
    duration_secs: Optional[int] = None
    final_conf: Optional[float] = None
    dialogue_log: Optional[List[Dict[str, Any]]] = None

class PhoneticGenerateRequest(BaseModel):
    text: str
    entity_type: Optional[str] = "alpha"
    standard: Optional[str] = "nato"

# --- Authentication Models ---
class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=6, max_length=100)
    role: Optional[str] = "Verification Officer"
    organization: Optional[str] = "Apex Bank BFSI"

class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=1)

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: str
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    status: str
    message: str
    token: str
    user: UserResponse


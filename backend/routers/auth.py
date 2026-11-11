from fastapi import APIRouter, HTTPException, Depends, Header, status
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

from backend.config import settings
from backend.database import db
from backend.models import UserRegisterRequest, UserLoginRequest, AuthResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def create_access_token(user_data: Dict[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {
        "sub": user_data["id"],
        "name": user_data["name"],
        "email": user_data["email"],
        "role": user_data.get("role", "Verification Officer"),
        "org": user_data.get("organization", "Apex Bank BFSI"),
        "exp": expire
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token

def get_user_from_token(token: Optional[str]) -> Dict[str, Any]:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token missing",
        )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account no longer exists")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired. Please login again.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token missing or invalid format"
        )
    token = authorization.split(" ", 1)[1]
    return get_user_from_token(token)

@router.post("/register", response_model=AuthResponse)
def register_user(req: UserRegisterRequest):
    # Check if email is already registered
    existing_user = db.get_user_by_email(req.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{req.email}' already exists. Please sign in instead."
        )
    
    # Securely hash password with bcrypt
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(req.password.encode('utf-8'), salt).decode('utf-8')
    
    # Store user in resilient database
    try:
        new_user = db.create_user(
            name=req.name,
            email=req.email,
            password_hash=hashed,
            role=req.role or "Verification Officer",
            organization=req.organization or "Apex Bank BFSI"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user account: {str(e)}"
        )
    
    token = create_access_token(new_user)
    
    return {
        "status": "success",
        "message": "Account created successfully",
        "token": token,
        "user": new_user
    }

@router.post("/login", response_model=AuthResponse)
def login_user(req: UserLoginRequest):
    user = db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
        )
    
    stored_hash = user.get("password_hash")
    if not stored_hash:
        # Fallback for seed user if not migrated
        stored_hash = "$2b$12$/fsqcwJxBPZRVdfZbt28t.8V7WncdoqCq532WW1.ajWfBhZQ0fSt6"
    
    try:
        matches = bcrypt.checkpw(req.password.encode('utf-8'), stored_hash.encode('utf-8'))
    except Exception:
        matches = False
        
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
        )
        
    user_sanitized = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "Verification Officer"),
        "organization": user.get("organization", "Apex Bank BFSI"),
        "created_at": user.get("created_at")
    }
    
    token = create_access_token(user_sanitized)
    
    return {
        "status": "success",
        "message": "Login successful. Welcome to EchoTrust.",
        "token": token,
        "user": user_sanitized
    }

@router.get("/me")
def get_authenticated_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "success",
        "user": current_user
    }


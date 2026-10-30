import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Argon2id password hasher with secure defaults
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16
)


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.AUTH_SECRET_KEY, algorithm=settings.AUTH_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.AUTH_SECRET_KEY, algorithms=[settings.AUTH_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


# Helper for Fernet symmetric encryption of upstream API credentials
def _get_fernet() -> Fernet:
    key = settings.AGENT_CREDENTIAL_ENCRYPTION_KEY
    try:
        # Check if key is valid 32-byte base64
        decoded = base64.urlsafe_b64decode(key.encode("utf-8"))
        if len(decoded) != 32:
            raise ValueError("Key must decode to 32 bytes")
        return Fernet(key.encode("utf-8"))
    except Exception:
        # Deterministically derive 32 bytes from the secret for developer convenience
        derived = hashlib.sha256(key.encode("utf-8")).digest()
        safe_b64 = base64.urlsafe_b64encode(derived)
        return Fernet(safe_b64)


def encrypt_secret(plain_text: str) -> str:
    """Encrypt upstream API secret before database persistence."""
    if not plain_text:
        return ""
    fernet = _get_fernet()
    encrypted_bytes = fernet.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    """Decrypt stored upstream API secret."""
    if not cipher_text:
        return ""
    try:
        fernet = _get_fernet()
        decrypted_bytes = fernet.decrypt(cipher_text.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        raise ValueError("Decryption failed: invalid encryption token or mismatched key")


# High-entropy Agent Credentials
def generate_agent_key() -> tuple[str, str, str]:
    """
    Generate an agent credential.
    Returns:
        (raw_token, key_prefix, hashed_key)
    Example raw_token: tt_agent_live_9f8d...
    """
    random_part = secrets.token_urlsafe(32)
    raw_token = f"tt_agent_{random_part}"
    key_prefix = raw_token[:12]  # e.g. "tt_agent_abc"
    hashed_key = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, key_prefix, hashed_key


def hash_agent_key(raw_token: str) -> str:
    """Hash raw agent token with SHA-256 for lookup."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

import base64
import hashlib
import hmac
import os
import secrets
import time

from fastapi import Depends, Header, HTTPException, Query
from ldap3 import Server, Connection
from ldap3.core.exceptions import LDAPException
from sqlalchemy.orm import Session

from .database import SessionLocal
from . import models

SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")
TOKEN_TTL_SECONDS = 60 * 60 * 24

PBKDF2_ITERATIONS = 100_000

LDAP_SERVER = os.getenv("LDAP_SERVER")  # e.g. "ldap://dc.example.local:389"


class LDAPConfigError(Exception):
    """LDAP_SERVER env var not set or empty."""


def ldap_authenticate(bind_dn: str, password: str) -> bool:
    """Verify credentials with a simple bind against LDAP_SERVER.
    bind_dn is the value stored in User.ldap (a UPN or full DN).
    Raises LDAPConfigError if LDAP_SERVER is not configured.
    Raises LDAPException (from ldap3) if the bind fails."""
    if not LDAP_SERVER:
        raise LDAPConfigError(
            "LDAP_SERVER не настроен на сервере. "
            "Добавьте переменную окружения LDAP_SERVER (например: ldap://dc.example.local:389)."
        )
    if not password:
        raise LDAPException("Пароль не указан")
    server = Server(LDAP_SERVER, connect_timeout=5)
    conn = Connection(server, user=bind_dn, password=password, auto_bind=True)
    conn.unbind()
    return True


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return hmac.compare_digest(check, digest)


def create_token(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time()) + TOKEN_TTL_SECONDS}"
    sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_token(token: str) -> int | None:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        user_id_str, expiry_str, sig = raw.split(":")
        payload = f"{user_id_str}:{expiry_str}"
        expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        if int(expiry_str) < time.time():
            return None
        return int(user_id_str)
    except Exception:
        return None


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: str | None = Header(None),
    token: str | None = Query(None),
    db: Session = Depends(_get_db),
) -> models.User:
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization[7:]
    elif token:
        raw = token

    user_id = decode_token(raw) if raw else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Не авторизован")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Не авторизован")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Только для администратора")
    return user


def require_can_edit(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.is_admin and user.role == "view":
        raise HTTPException(status_code=403, detail="Доступ только для просмотра")
    return user


def check_department_access(user: models.User, department: str, db: Session) -> None:
    if user.is_admin:
        return
    allowed = {
        ud.department for ud in
        db.query(models.UserDepartment).filter_by(user_id=user.id).all()
    }
    if department not in allowed:
        raise HTTPException(status_code=403, detail="Нет доступа к этому отделу")


def check_employee_access(user: models.User, emp_id: int, db: Session) -> models.Employee:
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    check_department_access(user, emp.department, db)
    return emp

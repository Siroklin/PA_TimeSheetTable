from pydantic import BaseModel
from typing import Literal, Optional


class DepartmentCreate(BaseModel):
    name: str


class Department(DepartmentCreate):
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    login: str
    password: str


class UserBase(BaseModel):
    name: str
    email: str = ""
    login: str
    is_admin: bool = False
    role: Literal["edit", "view"] = "edit"


class UserCreate(UserBase):
    password: str
    departments: list[str] = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    login: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    role: Optional[Literal["edit", "view"]] = None
    departments: Optional[list[str]] = None


class User(UserBase):
    id: int
    departments: list[str] = []

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: User


class EmployeeCreate(BaseModel):
    code: str
    name: str
    position: str
    department: str


class Employee(EmployeeCreate):
    id: int

    class Config:
        from_attributes = True


class EmployeeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    position: Optional[str] = None


class CellUpdate(BaseModel):
    day_status: Optional[str] = None
    night_status: Optional[str] = None
    day_comment: Optional[str] = None
    night_comment: Optional[str] = None
    shift: Optional[str] = None


class DepartmentPositionCreate(BaseModel):
    department: str
    position: str


class DepartmentPosition(DepartmentPositionCreate):
    id: int

    class Config:
        from_attributes = True


class SchedulePatternSave(BaseModel):
    employee_id: int
    year: int
    month: int
    pattern: str        # '2x2' | 'ДНОВ' | '5-0' | '6-1'
    shift: Optional[str] = None   # 'day' | 'night' | None for ДНОВ
    start_date: str     # 'YYYY-MM-DD'

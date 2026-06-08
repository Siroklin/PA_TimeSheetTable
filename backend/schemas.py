from pydantic import BaseModel
from typing import Optional


class EmployeeCreate(BaseModel):
    code: str
    name: str
    position: str
    department: str


class Employee(EmployeeCreate):
    id: int

    class Config:
        from_attributes = True


class CellUpdate(BaseModel):
    day_status: Optional[str] = None
    night_status: Optional[str] = None
    day_comment: Optional[str] = None
    night_comment: Optional[str] = None


class ShiftUpdate(BaseModel):
    shift: str  # 'day' | 'night'

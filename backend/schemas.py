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

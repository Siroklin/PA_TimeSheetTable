from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from .database import Base


class Employee(Base):
    __tablename__ = "employees"

    id         = Column(Integer, primary_key=True, index=True)
    code       = Column(String(20),  nullable=False)
    name       = Column(String(200), nullable=False)
    position   = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False, index=True)


class DepartmentPosition(Base):
    __tablename__ = "department_positions"

    id         = Column(Integer, primary_key=True)
    department = Column(String(100), nullable=False, index=True)
    position   = Column(String(100), nullable=False)

    __table_args__ = (UniqueConstraint("department", "position"),)


class SchedulePattern(Base):
    """Stores the pattern used when filling a schedule via Граф."""
    __tablename__ = "schedule_patterns"

    id          = Column(Integer, primary_key=True)
    employee_id = Column(Integer, nullable=False, index=True)
    year        = Column(Integer, nullable=False)
    month       = Column(Integer, nullable=False)
    pattern     = Column(String(20), nullable=False)   # '2x2' | 'ДНОВ' | '5-0' | '6-1'
    shift       = Column(String(20), nullable=True)    # 'day' | 'night' | None (ДНОВ)
    start_date  = Column(String(20), nullable=False)   # 'YYYY-MM-DD'

    __table_args__ = (UniqueConstraint("employee_id", "year", "month"),)


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id            = Column(Integer, primary_key=True)
    employee_id   = Column(Integer, nullable=False, index=True)
    year          = Column(Integer, nullable=False)
    month         = Column(Integer, nullable=False)
    day           = Column(Integer, nullable=False)
    shift         = Column(String(20), nullable=True)
    day_status    = Column(String(10), default="", nullable=False)
    night_status  = Column(String(10), default="", nullable=False)
    day_comment   = Column(Text, default="", nullable=False)
    night_comment = Column(Text, default="", nullable=False)

    __table_args__ = (UniqueConstraint("employee_id", "year", "month", "day"),)

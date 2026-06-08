from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from .database import Base


class Employee(Base):
    __tablename__ = "employees"

    id         = Column(Integer, primary_key=True, index=True)
    code       = Column(String(20),  nullable=False)
    name       = Column(String(200), nullable=False)
    position   = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False, index=True)


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id            = Column(Integer, primary_key=True)
    employee_id   = Column(Integer, nullable=False, index=True)
    year          = Column(Integer, nullable=False)
    month         = Column(Integer, nullable=False)
    day           = Column(Integer, nullable=False)
    shift         = Column(String(20), nullable=True)   # 'day' | 'night' | None
    day_status    = Column(String(10), default="", nullable=False)
    night_status  = Column(String(10), default="", nullable=False)
    day_comment   = Column(Text, default="", nullable=False)
    night_comment = Column(Text, default="", nullable=False)

    __table_args__ = (UniqueConstraint("employee_id", "year", "month", "day"),)

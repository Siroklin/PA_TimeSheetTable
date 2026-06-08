import io
import os

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from . import models
from . import schemas
from .excel import generate_excel

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Employees ─────────────────────────────────────────────────────────────────

@app.get("/api/employees", response_model=list[schemas.Employee])
def get_employees(department: str = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    )


@app.post("/api/employees", response_model=schemas.Employee)
def create_employee(emp: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_emp = models.Employee(**emp.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp


@app.post("/api/employees/bulk")
def bulk_employees(employees: list[schemas.EmployeeCreate], db: Session = Depends(get_db)):
    added = 0
    for emp in employees:
        exists = db.query(models.Employee).filter_by(
            code=emp.code, department=emp.department
        ).first()
        if not exists:
            db.add(models.Employee(**emp.model_dump()))
            added += 1
    db.commit()
    return {"added": added}


@app.delete("/api/employees/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.get(models.Employee, emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(emp)
    db.commit()
    return {"ok": True}


# ── Schedule ──────────────────────────────────────────────────────────────────

@app.get("/api/schedule")
def get_schedule(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    emp_ids = [
        e.id for e in db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    ]

    entries = (
        db.query(models.ScheduleEntry)
        .filter(
            models.ScheduleEntry.employee_id.in_(emp_ids),
            models.ScheduleEntry.year == year,
            models.ScheduleEntry.month == month,
        )
        .all()
    )

    result: dict = {eid: {} for eid in emp_ids}
    for e in entries:
        result[e.employee_id][e.day] = {
            "day":          e.day_status,
            "nightShift":   e.night_status,
            "dayComment":   e.day_comment,
            "nightComment": e.night_comment,
        }
    return result


@app.put("/api/schedule/{emp_id}/{year}/{month}/{day}")
def update_cell(
    emp_id: int,
    year: int,
    month: int,
    day: int,
    cell: schemas.CellUpdate,
    db: Session = Depends(get_db),
):
    entry = (
        db.query(models.ScheduleEntry)
        .filter_by(employee_id=emp_id, year=year, month=month, day=day)
        .first()
    )

    if not entry:
        entry = models.ScheduleEntry(
            employee_id=emp_id, year=year, month=month, day=day,
            day_status="", night_status="", day_comment="", night_comment="",
        )
        db.add(entry)

    if cell.day_status is not None:
        entry.day_status = cell.day_status
    if cell.night_status is not None:
        entry.night_status = cell.night_status
    if cell.day_comment is not None:
        entry.day_comment = cell.day_comment
    if cell.night_comment is not None:
        entry.night_comment = cell.night_comment

    db.commit()
    return {"ok": True}


# ── Employee shifts ───────────────────────────────────────────────────────────

@app.get("/api/employee-shifts")
def get_employee_shifts(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    emp_ids = [
        e.id for e in db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    ]
    rows = db.query(models.EmployeeShift).filter(
        models.EmployeeShift.employee_id.in_(emp_ids),
        models.EmployeeShift.year == year,
        models.EmployeeShift.month == month,
    ).all()
    return {r.employee_id: r.shift for r in rows}


@app.put("/api/employee-shifts/{emp_id}/{year}/{month}")
def update_employee_shift(
    emp_id: int,
    year: int,
    month: int,
    body: schemas.ShiftUpdate,
    db: Session = Depends(get_db),
):
    row = db.query(models.EmployeeShift).filter_by(
        employee_id=emp_id, year=year, month=month
    ).first()
    if not row:
        row = models.EmployeeShift(employee_id=emp_id, year=year, month=month, shift=body.shift)
        db.add(row)
    else:
        row.shift = body.shift
    db.commit()
    return {"ok": True}


# ── Export ────────────────────────────────────────────────────────────────────

_MONTH_NAMES_FILE = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]


@app.get("/api/export/excel")
def export_excel(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    employees = (
        db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    )
    emp_ids = [e.id for e in employees]

    entries = (
        db.query(models.ScheduleEntry)
        .filter(
            models.ScheduleEntry.employee_id.in_(emp_ids),
            models.ScheduleEntry.year == year,
            models.ScheduleEntry.month == month,
        )
        .all()
    )

    schedule_map: dict = {eid: {} for eid in emp_ids}
    for e in entries:
        schedule_map[e.employee_id][e.day] = {
            "day":        e.day_status,
            "nightShift": e.night_status,
        }

    wb = generate_excel(employees, schedule_map, year, month, department)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"график_{department}_{_MONTH_NAMES_FILE[month - 1]}_{year}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


# ── Serve built frontend (production) ────────────────────────────────────────

_dist = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")

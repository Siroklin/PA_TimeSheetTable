import calendar
import io
import os
from datetime import date, timedelta
from urllib.parse import quote

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from . import models
from . import schemas
from .excel import generate_excel

Base.metadata.create_all(bind=engine)

LEGACY_DEPARTMENTS = ["Цех №1", "Цех №2", "Цех №3", "Склад", "ПроИнокс"]


def _seed_departments():
    """First-run seed: populate the departments table from existing employee
    data plus the legacy hardcoded list, so existing rows keep a valid FK."""
    db = SessionLocal()
    try:
        if db.query(models.Department).first():
            return
        names = {d for (d,) in db.query(models.Employee.department).distinct()}
        names.update(LEGACY_DEPARTMENTS)
        for name in sorted(names):
            db.add(models.Department(name=name))
        db.commit()
    finally:
        db.close()


_seed_departments()

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


# ── Departments ───────────────────────────────────────────────────────────────

@app.get("/api/departments", response_model=list[schemas.Department])
def get_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).order_by(models.Department.name).all()


@app.post("/api/departments", response_model=schemas.Department)
def create_department(body: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    existing = db.get(models.Department, body.name)
    if existing:
        raise HTTPException(status_code=409, detail="Уже существует")
    obj = models.Department(name=body.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/api/departments/{name}")
def delete_department(name: str, db: Session = Depends(get_db)):
    obj = db.get(models.Department, name)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    in_use = (
        db.query(models.Employee).filter_by(department=name).first()
        or db.query(models.DepartmentPosition).filter_by(department=name).first()
    )
    if in_use:
        raise HTTPException(status_code=400, detail="Нельзя удалить — отдел используется сотрудниками или должностями")
    db.delete(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Нельзя удалить — отдел используется сотрудниками или должностями")
    return {"ok": True}


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
    if cell.shift is not None:
        entry.shift = cell.shift

    db.commit()
    return {"ok": True}


@app.delete("/api/schedule/{emp_id}/{year}/{month}")
def clear_schedule(
    emp_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    db.query(models.ScheduleEntry).filter_by(
        employee_id=emp_id, year=year, month=month
    ).delete()
    db.commit()
    return {"ok": True}


# ── Employee shifts (читаем из schedule_entries) ──────────────────────────────

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

    rows = (
        db.query(models.ScheduleEntry.employee_id, models.ScheduleEntry.shift)
        .filter(
            models.ScheduleEntry.employee_id.in_(emp_ids),
            models.ScheduleEntry.year == year,
            models.ScheduleEntry.month == month,
            models.ScheduleEntry.shift.isnot(None),
        )
        .all()
    )

    result = {}
    for emp_id, shift in rows:
        if emp_id not in result:
            result[emp_id] = shift
    return result


# ── Department-Position reference ─────────────────────────────────────────────

@app.get("/api/positions", response_model=list[schemas.DepartmentPosition])
def get_positions(department: str = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(models.DepartmentPosition)
        .filter(models.DepartmentPosition.department == department)
        .order_by(models.DepartmentPosition.position)
        .all()
    )


@app.post("/api/positions", response_model=schemas.DepartmentPosition)
def add_position(body: schemas.DepartmentPositionCreate, db: Session = Depends(get_db)):
    existing = db.query(models.DepartmentPosition).filter_by(
        department=body.department, position=body.position
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Уже существует")
    obj = models.DepartmentPosition(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/api/positions/{pos_id}")
def delete_position(pos_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.DepartmentPosition, pos_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Schedule patterns ─────────────────────────────────────────────────────────

@app.post("/api/schedule-patterns")
def save_schedule_pattern(body: schemas.SchedulePatternSave, db: Session = Depends(get_db)):
    existing = db.query(models.SchedulePattern).filter_by(
        employee_id=body.employee_id, year=body.year, month=body.month
    ).first()
    if existing:
        existing.pattern    = body.pattern
        existing.shift      = body.shift
        existing.start_date = body.start_date
    else:
        db.add(models.SchedulePattern(**body.model_dump()))
    db.commit()
    return {"ok": True}


# ── Copy schedule ─────────────────────────────────────────────────────────────

def _apply_pattern_py(pattern: str, year: int, month: int, shift: str | None, start_date: date) -> dict:
    """
    Returns {day: {day_status, night_status}} for every day in the target month.
    Replicates the JS applyPattern logic so cycles continue seamlessly.
    """
    days_in_month = calendar.monthrange(year, month)[1]
    result = {}

    for d in range(1, days_in_month + 1):
        current = date(year, month, d)
        # Python weekday(): 0=Mon…6=Sun  →  JS getDay() equiv: Mon=1…Sun=0
        # For 5-0/6-1 we need JS-style: Mon-Fri = 1..5, Sat=6, Sun=0
        dow_py = current.weekday()  # 0=Mon … 6=Sun
        # convert: Mon=1..Sat=6,Sun=0
        dow_js = (dow_py + 1) % 7   # Mon→1 … Sun→0   (same as JS getDay for Mon-Sat range)

        diff = (current - start_date).days

        if pattern == 'ДНОВ':
            if diff < 0:
                result[d] = {'day_status': '', 'night_status': ''}
            else:
                phase = diff % 4
                if phase == 0:
                    result[d] = {'day_status': 'Р', 'night_status': ''}
                elif phase == 1:
                    result[d] = {'day_status': '', 'night_status': 'Р'}
                elif phase == 2:
                    result[d] = {'day_status': 'С', 'night_status': ''}
                else:
                    result[d] = {'day_status': 'В', 'night_status': ''}
        else:
            if pattern == '5-0':
                val = 'Р' if 1 <= dow_js <= 5 else 'В'
            elif pattern == '6-1':
                val = 'Р' if 1 <= dow_js <= 6 else 'В'
            elif pattern == '2x2':
                if diff < 0:
                    val = ''
                else:
                    val = 'Р' if (diff % 4) < 2 else 'В'
            else:
                val = ''

            if shift == 'night':
                result[d] = {'day_status': '', 'night_status': val}
            else:
                result[d] = {'day_status': val, 'night_status': ''}

    return result


@app.post("/api/copy-schedule")
def copy_schedule(
    department:  str = Query(...),
    from_year:   int = Query(...),
    from_month:  int = Query(...),
    to_year:     int = Query(...),
    to_month:    int = Query(...),
    db: Session = Depends(get_db),
):
    employees = (
        db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    )

    copied = 0
    for emp in employees:
        pattern_rec = (
            db.query(models.SchedulePattern)
            .filter_by(employee_id=emp.id, year=from_year, month=from_month)
            .first()
        )

        if not pattern_rec:
            # No pattern stored — fall back to copying entries verbatim
            src_entries = (
                db.query(models.ScheduleEntry)
                .filter_by(employee_id=emp.id, year=from_year, month=from_month)
                .all()
            )
            if not src_entries:
                continue

            db.query(models.ScheduleEntry).filter_by(
                employee_id=emp.id, year=to_year, month=to_month
            ).delete()

            days_in_target = calendar.monthrange(to_year, to_month)[1]
            src_map = {e.day: e for e in src_entries}
            emp_shift = next((e.shift for e in src_entries if e.shift), None)

            for d in range(1, days_in_target + 1):
                src = src_map.get(d)
                if src:
                    db.add(models.ScheduleEntry(
                        employee_id=emp.id,
                        year=to_year, month=to_month, day=d,
                        day_status=src.day_status,
                        night_status=src.night_status,
                        day_comment='', night_comment='',
                        shift=src.shift,
                    ))
            copied += 1
            continue

        # Parse stored start_date
        parts = pattern_rec.start_date.split('-')
        start_dt = date(int(parts[0]), int(parts[1]), int(parts[2]))

        # Generate new schedule using the SAME start_date — cycle continues naturally
        day_map = _apply_pattern_py(
            pattern_rec.pattern, to_year, to_month,
            pattern_rec.shift, start_dt,
        )

        # Clear target month entries
        db.query(models.ScheduleEntry).filter_by(
            employee_id=emp.id, year=to_year, month=to_month
        ).delete()

        for d, statuses in day_map.items():
            if statuses['day_status'] or statuses['night_status']:
                db.add(models.ScheduleEntry(
                    employee_id=emp.id,
                    year=to_year, month=to_month, day=d,
                    day_status=statuses['day_status'],
                    night_status=statuses['night_status'],
                    day_comment='', night_comment='',
                    shift=pattern_rec.shift,
                ))

        # Copy (upsert) pattern record to target month
        dest_pattern = db.query(models.SchedulePattern).filter_by(
            employee_id=emp.id, year=to_year, month=to_month
        ).first()
        if dest_pattern:
            dest_pattern.pattern    = pattern_rec.pattern
            dest_pattern.shift      = pattern_rec.shift
            dest_pattern.start_date = pattern_rec.start_date
        else:
            db.add(models.SchedulePattern(
                employee_id=emp.id,
                year=to_year, month=to_month,
                pattern=pattern_rec.pattern,
                shift=pattern_rec.shift,
                start_date=pattern_rec.start_date,
            ))

        copied += 1

    db.commit()
    return {"copied": copied}


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

    filename = f"график_{department}_{_MONTH_NAMES_FILE[month - 1]}_{year}.xlsx"
    encoded  = quote(filename, encoding="utf-8")
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="schedule_{year}_{month:02d}.xlsx";'
                f" filename*=UTF-8''{encoded}"
            )
        },
    )


# ── Serve built frontend (production) ────────────────────────────────────────

_dist = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")

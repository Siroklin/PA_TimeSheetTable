import calendar
import io
import os
import re
from collections import Counter
from datetime import date, timedelta
from urllib.parse import quote

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from . import models
from . import schemas
from .excel import generate_excel
from .auth import (
    hash_password, verify_password, create_token, ldap_authenticate,
    get_current_user, require_admin, require_can_edit,
    check_department_access, check_employee_access,
)

Base.metadata.create_all(bind=engine)


def _migrate_add_user_role_column():
    """create_all() doesn't alter pre-existing tables — add the 'role'
    column to users if upgrading from a version without it."""
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "role" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'edit'"
            ))
    if "ldap" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN ldap VARCHAR(200) NOT NULL DEFAULT ''"
            ))


_migrate_add_user_role_column()

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


def _seed_admin():
    """First-run seed: create the default admin/admin account."""
    db = SessionLocal()
    try:
        if db.query(models.User).first():
            return
        db.add(models.User(
            name="Администратор", email="", login="admin",
            password_hash=hash_password("admin"), is_admin=True,
        ))
        db.commit()
    finally:
        db.close()


_seed_departments()
_seed_admin()

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


def _user_out(db: Session, u: models.User) -> schemas.User:
    depts = [
        ud.department for ud in
        db.query(models.UserDepartment).filter_by(user_id=u.id)
        .order_by(models.UserDepartment.department).all()
    ]
    return schemas.User(
        id=u.id, name=u.name, email=u.email, login=u.login, ldap=u.ldap,
        is_admin=u.is_admin, role=u.role, departments=depts,
    )


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(login=body.login).first()
    if not user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if user.ldap:
        authenticated = ldap_authenticate(user.ldap, body.password)
    else:
        authenticated = verify_password(body.password, user.password_hash)
    if not authenticated:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_token(user.id)
    return schemas.LoginResponse(token=token, user=_user_out(db, user))


@app.get("/api/auth/me", response_model=schemas.User)
def me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db, current_user)


# ── Users (admin only) ───────────────────────────────────────────────────────

@app.get("/api/users", response_model=list[schemas.User])
def list_users(_: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    return [_user_out(db, u) for u in db.query(models.User).order_by(models.User.login).all()]


@app.post("/api/users", response_model=schemas.User)
def create_user(body: schemas.UserCreate, _: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(login=body.login).first():
        raise HTTPException(status_code=409, detail="Такой логин уже существует")
    u = models.User(
        name=body.name, email=body.email, login=body.login, ldap=body.ldap,
        password_hash=hash_password(body.password) if body.password else "",
        is_admin=body.is_admin, role=body.role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    for dept in body.departments:
        db.add(models.UserDepartment(user_id=u.id, department=dept))
    db.commit()
    return _user_out(db, u)


@app.put("/api/users/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int, body: schemas.UserUpdate,
    _: models.User = Depends(require_admin), db: Session = Depends(get_db),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    if body.login and body.login != u.login:
        if db.query(models.User).filter_by(login=body.login).first():
            raise HTTPException(status_code=409, detail="Такой логин уже существует")
        u.login = body.login
    if body.name is not None:
        u.name = body.name
    if body.email is not None:
        u.email = body.email
    if body.ldap is not None:
        u.ldap = body.ldap
    if body.is_admin is not None:
        u.is_admin = body.is_admin
    if body.role is not None:
        u.role = body.role
    if body.password:
        u.password_hash = hash_password(body.password)
    if body.departments is not None:
        db.query(models.UserDepartment).filter_by(user_id=u.id).delete()
        for dept in body.departments:
            db.add(models.UserDepartment(user_id=u.id, department=dept))
    db.commit()
    return _user_out(db, u)


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, admin: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    db.query(models.UserDepartment).filter_by(user_id=user_id).delete()
    db.delete(u)
    db.commit()
    return {"ok": True}


# ── Departments ───────────────────────────────────────────────────────────────

@app.get("/api/departments", response_model=list[schemas.Department])
def get_departments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Department).order_by(models.Department.name).all()


@app.post("/api/departments", response_model=schemas.Department)
def create_department(
    body: schemas.DepartmentCreate, db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = db.get(models.Department, body.name)
    if existing:
        raise HTTPException(status_code=409, detail="Уже существует")
    obj = models.Department(name=body.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/api/departments/{name}")
def delete_department(
    name: str, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    obj = db.get(models.Department, name)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")

    emp_ids = [
        e.id for e in db.query(models.Employee.id).filter_by(department=name).all()
    ]
    if emp_ids:
        db.query(models.ScheduleEntry).filter(models.ScheduleEntry.employee_id.in_(emp_ids)).delete(
            synchronize_session=False
        )
        db.query(models.SchedulePattern).filter(models.SchedulePattern.employee_id.in_(emp_ids)).delete(
            synchronize_session=False
        )
        db.query(models.Employee).filter_by(department=name).delete(synchronize_session=False)

    db.query(models.DepartmentPosition).filter_by(department=name).delete(synchronize_session=False)
    db.query(models.UserDepartment).filter_by(department=name).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Employees ─────────────────────────────────────────────────────────────────

@app.get("/api/employees", response_model=list[schemas.Employee])
def get_employees(
    department: str = Query(...),
    year: int = Query(None),
    month: int = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    check_department_access(current_user, department, db)
    q = db.query(models.Employee).filter(models.Employee.department == department)

    if year is not None and month is not None:
        has_entries = (
            db.query(models.ScheduleEntry.employee_id)
            .filter_by(year=year, month=month)
            .distinct()
            .subquery()
        )
        q = q.filter(models.Employee.id.in_(has_entries))

    return q.all()


@app.post("/api/employees", response_model=schemas.Employee)
def create_employee(
    emp: schemas.EmployeeCreate,
    year: int = Query(None),
    month: int = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    check_department_access(current_user, emp.department, db)
    exists = db.query(models.Employee).filter_by(
        code=emp.code, department=emp.department
    ).first()
    if exists:
        raise HTTPException(
            status_code=400,
            detail="Сотрудник с таким кодом уже существует в этом отделе",
        )
    db_emp = models.Employee(**emp.model_dump())
    db.add(db_emp)
    db.flush()
    if year and month:
        db.add(models.ScheduleEntry(
            employee_id=db_emp.id, year=year, month=month, day=1,
            day_status="", night_status="", day_comment="", night_comment="",
        ))
    db.commit()
    db.refresh(db_emp)
    return db_emp


@app.put("/api/employees/{emp_id}", response_model=schemas.Employee)
def update_employee(
    emp_id: int, patch: schemas.EmployeeUpdate, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    emp = check_employee_access(current_user, emp_id, db)
    new_code = patch.code if patch.code is not None else emp.code
    if new_code != emp.code:
        exists = db.query(models.Employee).filter(
            models.Employee.department == emp.department,
            models.Employee.code == new_code,
            models.Employee.id != emp_id,
        ).first()
        if exists:
            raise HTTPException(
                status_code=400,
                detail="Сотрудник с таким кодом уже существует в этом отделе",
            )
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    return emp


@app.post("/api/employees/bulk")
def bulk_employees(
    employees: list[schemas.EmployeeCreate], db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    for emp in employees:
        check_department_access(current_user, emp.department, db)
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
def delete_employee(
    emp_id: int, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    check_employee_access(current_user, emp_id, db)
    emp = db.get(models.Employee, emp_id)
    db.delete(emp)
    db.commit()
    return {"ok": True}


# ── Schedule ──────────────────────────────────────────────────────────────────

_CODE_RE = re.compile(r"^(\D*)(\d+)?$")


def _is_work_value(value: str | None) -> bool:
    """Mirrors mockData.js isWorkValue: a cell counts as "working" when its
    value is plain hours with no letter status code (e.g. "8", "11")."""
    if not value:
        return False
    m = _CODE_RE.match(value)
    code = (m.group(1) if m else value) or ""
    return code == ""


def _check_no_cross_department_conflict(
    db: Session, emp: models.Employee, year: int, month: int, day: int,
    day_status: str, night_status: str,
):
    """An employee (matched by personnel code) can't be scheduled to work in
    two departments on the same calendar day."""
    if not (_is_work_value(day_status) or _is_work_value(night_status)):
        return
    other_emps = {
        e.id: e for e in db.query(models.Employee).filter(
            models.Employee.code == emp.code,
            models.Employee.department != emp.department,
        ).all()
    }
    if not other_emps:
        return
    conflicts = (
        db.query(models.ScheduleEntry)
        .filter(
            models.ScheduleEntry.employee_id.in_(other_emps.keys()),
            models.ScheduleEntry.year == year,
            models.ScheduleEntry.month == month,
            models.ScheduleEntry.day == day,
        )
        .all()
    )
    for c in conflicts:
        if _is_work_value(c.day_status) or _is_work_value(c.night_status):
            other_dept = other_emps[c.employee_id].department
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Сотрудник с кодом {emp.code} уже работает {day:02d}.{month:02d}.{year} "
                    f"в отделе «{other_dept}»"
                ),
            )


@app.get("/api/schedule")
def get_schedule(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    check_department_access(current_user, department, db)
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
    current_user: models.User = Depends(require_can_edit),
):
    emp = check_employee_access(current_user, emp_id, db)
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

    new_day_status = cell.day_status if cell.day_status is not None else entry.day_status
    new_night_status = cell.night_status if cell.night_status is not None else entry.night_status
    if cell.day_status is not None or cell.night_status is not None:
        _check_no_cross_department_conflict(db, emp, year, month, day, new_day_status, new_night_status)

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
    current_user: models.User = Depends(require_can_edit),
):
    check_employee_access(current_user, emp_id, db)
    db.query(models.ScheduleEntry).filter_by(
        employee_id=emp_id, year=year, month=month
    ).delete()
    db.query(models.SchedulePattern).filter_by(
        employee_id=emp_id, year=year, month=month
    ).delete()
    db.commit()
    return {"ok": True}


# ── Clear department schedule (admin only) ────────────────────────────────────

@app.delete("/api/schedule/department")
def clear_department_schedule(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    check_department_access(current_user, department, db)
    emp_ids = [
        e.id for e in db.query(models.Employee.id)
        .filter(models.Employee.department == department).all()
    ]
    if emp_ids:
        q_entries = db.query(models.ScheduleEntry).filter(
            models.ScheduleEntry.employee_id.in_(emp_ids),
            models.ScheduleEntry.year == year,
        )
        q_patterns = db.query(models.SchedulePattern).filter(
            models.SchedulePattern.employee_id.in_(emp_ids),
            models.SchedulePattern.year == year,
        )
        if month is not None:
            q_entries  = q_entries.filter(models.ScheduleEntry.month == month)
            q_patterns = q_patterns.filter(models.SchedulePattern.month == month)
        q_entries.delete(synchronize_session=False)
        q_patterns.delete(synchronize_session=False)
    db.commit()
    return {"cleared": len(emp_ids)}


# ── Employee shifts (читаем из schedule_entries) ──────────────────────────────

@app.get("/api/employee-shifts")
def get_employee_shifts(
    department: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    check_department_access(current_user, department, db)
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
def get_positions(
    department: str = Query(...), db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    check_department_access(current_user, department, db)
    return (
        db.query(models.DepartmentPosition)
        .filter(models.DepartmentPosition.department == department)
        .order_by(models.DepartmentPosition.position)
        .all()
    )


@app.post("/api/positions", response_model=schemas.DepartmentPosition)
def add_position(
    body: schemas.DepartmentPositionCreate, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    check_department_access(current_user, body.department, db)
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
def delete_position(
    pos_id: int, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    obj = db.get(models.DepartmentPosition, pos_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    check_department_access(current_user, obj.department, db)
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Schedule patterns ─────────────────────────────────────────────────────────

@app.get("/api/schedule-patterns/{employee_id}")
def get_schedule_pattern(
    employee_id: int, year: int, month: int, db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    check_employee_access(current_user, employee_id, db)
    rec = db.query(models.SchedulePattern).filter_by(
        employee_id=employee_id, year=year, month=month
    ).first()
    if not rec:
        return None
    return {
        "pattern": rec.pattern, "shift": rec.shift, "start_date": rec.start_date,
    }


@app.post("/api/schedule-patterns")
def save_schedule_pattern(
    body: schemas.SchedulePatternSave, db: Session = Depends(get_db),
    current_user: models.User = Depends(require_can_edit),
):
    check_employee_access(current_user, body.employee_id, db)
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

# Реальные отсутствия — не переносятся при копировании месяца, вместо них
# подставляются обычные рабочие часы по графику. Выходной (В), доп. смена (Д),
# сверхурочные (С) и увольнение (У) — это часть графика/работы, а не отсутствие,
# поэтому переносятся как есть (увольнение отдельно отфильтровывает сотрудника целиком).
_ABSENCE_CODES = {'О', 'Б', 'ДО', 'П', 'К', 'Ф'}

_STATUS_CODE_RE = re.compile(r'^(\D*)(\d+)?$')


def _status_code(value: str | None) -> str:
    if not value:
        return ''
    m = _STATUS_CODE_RE.match(value)
    return m.group(1) if m else value


def _replace_absences_with_work(src_entries: list) -> dict:
    """
    Returns {day: (day_status, night_status)} where any day/night status coded
    as a real absence is replaced by the most common non-absence value for
    that weekday (so the employee's usual working pattern is restored instead
    of carrying the absence forward).
    """
    day_baseline = {}    # weekday (0=Mon) -> Counter of non-absence day_status values
    night_baseline = {}
    for e in src_entries:
        wd = date(e.year, e.month, e.day).weekday()
        if _status_code(e.day_status) not in _ABSENCE_CODES:
            day_baseline.setdefault(wd, Counter())[e.day_status] += 1
        if _status_code(e.night_status) not in _ABSENCE_CODES:
            night_baseline.setdefault(wd, Counter())[e.night_status] += 1

    result = {}
    for e in src_entries:
        wd = date(e.year, e.month, e.day).weekday()
        day_status = e.day_status
        if _status_code(day_status) in _ABSENCE_CODES:
            counter = day_baseline.get(wd)
            day_status = counter.most_common(1)[0][0] if counter else ''
        night_status = e.night_status
        if _status_code(night_status) in _ABSENCE_CODES:
            counter = night_baseline.get(wd)
            night_status = counter.most_common(1)[0][0] if counter else ''
        result[e.day] = (day_status, night_status)
    return result


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
                    result[d] = {'day_status': '11', 'night_status': ''}
                elif phase == 1:
                    result[d] = {'day_status': '', 'night_status': '11'}
                elif phase == 2:
                    result[d] = {'day_status': 'В', 'night_status': ''}
                else:
                    result[d] = {'day_status': 'В', 'night_status': ''}
        else:
            if pattern == '5-0':
                val = '8' if 1 <= dow_js <= 5 else 'В'
            elif pattern == '6-1':
                val = '11' if 1 <= dow_js <= 6 else 'В'
            elif pattern == '2x2':
                if diff < 0:
                    val = ''
                else:
                    val = '11' if (diff % 4) < 2 else 'В'
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
    current_user: models.User = Depends(require_can_edit),
):
    check_department_access(current_user, department, db)
    employees = (
        db.query(models.Employee)
        .filter(models.Employee.department == department)
        .all()
    )

    copied = 0
    for emp in employees:
        dismissed = (
            db.query(models.ScheduleEntry)
            .filter(
                models.ScheduleEntry.employee_id == emp.id,
                models.ScheduleEntry.year == from_year,
                models.ScheduleEntry.month == from_month,
                (models.ScheduleEntry.day_status.like('У%')) | (models.ScheduleEntry.night_status.like('У%')),
            )
            .first()
        )
        if dismissed:
            # Уволенный сотрудник не переносится в новый месяц — и если в целевом
            # месяце уже была более ранняя запись (например, от скользящего
            # графика), её нужно убрать, а не просто пропустить копирование.
            db.query(models.ScheduleEntry).filter_by(
                employee_id=emp.id, year=to_year, month=to_month
            ).delete()
            db.query(models.SchedulePattern).filter_by(
                employee_id=emp.id, year=to_year, month=to_month
            ).delete()
            continue

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
            resolved = _replace_absences_with_work(src_entries)

            for d in range(1, days_in_target + 1):
                src = src_map.get(d)
                if src:
                    day_status, night_status = resolved[d]
                    db.add(models.ScheduleEntry(
                        employee_id=emp.id,
                        year=to_year, month=to_month, day=d,
                        day_status=day_status,
                        night_status=night_status,
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
    current_user: models.User = Depends(get_current_user),
):
    check_department_access(current_user, department, db)
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

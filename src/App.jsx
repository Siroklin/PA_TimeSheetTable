import { useState, useMemo, useEffect, useCallback } from 'react';
import Filters from './components/Filters';
import ScheduleTable from './components/ScheduleTable';
import CellEditor from './components/CellEditor';
import ScheduleFiller from './components/ScheduleFiller';
import EmployeeUpload from './components/EmployeeUpload';
import AddEmployee from './components/AddEmployee';
import {
  fetchEmployees, fetchSchedule, updateCell, getExportUrl,
  fetchEmployeeShifts, clearSchedule, deleteEmployee,
} from './api';
import './App.css';

export default function App() {
  const now = new Date();

  const [period, setPeriod] = useState({
    year:  now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const [filters, setFilters] = useState({
    department: 'Цех №1',
    position:   'all',
    shift:      'all',
  });

  const [employees, setEmployees]     = useState([]);
  const [scheduleMap, setScheduleMap] = useState({});
  const [shiftsMap, setShiftsMap]     = useState({});
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const [editingCell, setEditingCell]         = useState(null);
  const [fillingEmp, setFillingEmp]           = useState(null);
  const [showUpload, setShowUpload]           = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const { year, month } = period;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, sched, shifts] = await Promise.all([
        fetchEmployees(filters.department),
        fetchSchedule(filters.department, year, month),
        fetchEmployeeShifts(filters.department, year, month),
      ]);
      setEmployees(emps);
      setScheduleMap(sched);
      setShiftsMap(shifts);
    } catch {
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  }, [filters.department, year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter rows: by position, then by assigned shift
  const visibleEmployees = useMemo(() => {
    let result = employees;
    if (filters.position !== 'all') {
      result = result.filter(e => e.position === filters.position);
    }
    if (filters.shift !== 'all') {
      result = result.filter(e => {
        const empShift = shiftsMap[e.id] ?? shiftsMap[String(e.id)];
        if (filters.shift === 'night') return empShift === 'night';
        return empShift === 'day' || !empShift; // day or not yet assigned
      });
    }
    return result;
  }, [employees, filters.position, filters.shift, shiftsMap]);

  function handleCellClick(emp, day, shiftType) {
    const cell = scheduleMap[emp.id]?.[day] ?? {};
    setEditingCell({
      empId:       emp.id,
      empName:     emp.name,
      empPosition: emp.position,
      day, shiftType, year, month,
      value:   shiftType === 'day' ? (cell.day ?? '') : (cell.nightShift ?? ''),
      comment: shiftType === 'day' ? (cell.dayComment ?? '') : (cell.nightComment ?? ''),
    });
  }

  async function handleCellSave({ empId, day, shiftType, value, comment }) {
    const patch = shiftType === 'day'
      ? { day_status: value, day_comment: comment }
      : { night_status: value, night_comment: comment };

    setScheduleMap(prev => {
      const empDay = { ...(prev[empId]?.[day] ?? {}) };
      if (shiftType === 'day') { empDay.day = value; empDay.dayComment = comment; }
      else { empDay.nightShift = value; empDay.nightComment = comment; }
      return { ...prev, [empId]: { ...prev[empId], [day]: empDay } };
    });

    await updateCell(empId, year, month, day, patch);
  }

  async function handleFillApply(empId, updates, shift) {
    // Optimistic: replace entire month with pattern
    const daysInMonth = new Date(year, month, 0).getDate();
    const newSched = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const u = updates[d] ?? {};
      newSched[d] = {
        day:          u.day          ?? '',
        nightShift:   u.nightShift   ?? '',
        dayComment:   '',
        nightComment: '',
      };
    }
    setScheduleMap(prev => ({ ...prev, [empId]: newSched }));

    // Optimistic shift badge update (not for ДНОВ)
    if (shift) {
      setShiftsMap(prev => ({ ...prev, [empId]: shift }));
    }

    // Clear old schedule, then save new (shift stored in each entry)
    await clearSchedule(empId, year, month);
    const calls = Object.entries(updates)
      .filter(([, u]) => Object.keys(u).length > 0)
      .map(([d, u]) => {
        const patch = {};
        if ('day' in u)        patch.day_status   = u.day;
        if ('nightShift' in u) patch.night_status = u.nightShift;
        if (shift)             patch.shift        = shift;
        return updateCell(empId, year, month, Number(d), patch);
      });
    await Promise.all(calls);
  }

  async function handleDeleteEmployee(empId) {
    if (!confirm('Удалить сотрудника из системы? Это действие необратимо.')) return;
    await deleteEmployee(empId);
    loadData();
  }

  const exportUrl = getExportUrl(filters.department, year, month);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-main">
          <h1>График работы сотрудников</h1>
        </div>
        <a className="btn-export" href={exportUrl} download>
          Скачать Excel
        </a>
      </header>

      <Filters
        filters={filters}
        period={period}
        onFilterChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
        onPeriodChange={setPeriod}
        onAddEmployee={() => setShowAddEmployee(true)}
        onUploadClick={() => setShowUpload(true)}
      />

      {error && <div className="load-error">{error}</div>}

      {loading ? (
        <div className="load-spinner">Загрузка...</div>
      ) : (
        <div className="table-container">
          <ScheduleTable
            employees={visibleEmployees}
            schedule={scheduleMap}
            shifts={shiftsMap}
            year={year}
            month={month}
            shiftFilter={filters.shift}
            onCellClick={handleCellClick}
            onFillClick={setFillingEmp}
            onDeleteEmployee={handleDeleteEmployee}
          />
        </div>
      )}

      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: '#d4edda' }} />Р — Работает</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#fff3cd' }} />В — Выходной</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#cce5ff' }} />О — Отпуск</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#f8d7da' }} />Б — Больничный</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#e8d5f5' }} />С — Отсыпной</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#ebebeb', border: '1px solid #c8d0da' }} />День (пусто)</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#c8c8c8', border: '1px solid #aaa' }} />Ночь (пусто)</div>
        <div className="legend-item"><span className="comment-dot-demo" />Комментарий</div>
      </div>

      {editingCell && (
        <CellEditor cell={editingCell} onSave={handleCellSave} onClose={() => setEditingCell(null)} />
      )}
      {fillingEmp && (
        <ScheduleFiller
          employee={fillingEmp} year={year} month={month}
          onApply={handleFillApply} onClose={() => setFillingEmp(null)}
        />
      )}
      {showUpload && (
        <EmployeeUpload onSuccess={loadData} onClose={() => setShowUpload(false)} />
      )}
      {showAddEmployee && (
        <AddEmployee
          department={filters.department}
          onSuccess={loadData}
          onClose={() => setShowAddEmployee(false)}
        />
      )}
    </div>
  );
}

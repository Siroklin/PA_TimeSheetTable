import { useState, useMemo, useEffect } from 'react';
import Filters from './components/Filters';
import ScheduleTable from './components/ScheduleTable';
import CellEditor from './components/CellEditor';
import ScheduleFiller from './components/ScheduleFiller';
import EmployeeUpload from './components/EmployeeUpload';
import { defaultEmployees, generateSchedule } from './mockData';
import './App.css';

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo:   `${year}-${month}-${lastDay}`,
  };
}

export default function App() {
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getDefaultDates();

  const [filters, setFilters] = useState({
    department: 'Цех №1',
    position:   'all',
    shift:      'all',
    dateFrom:   defaultFrom,
    dateTo:     defaultTo,
  });

  const [employeesMap, setEmployeesMap] = useState(defaultEmployees);
  const [scheduleMap, setScheduleMap]   = useState({});
  const [editingCell, setEditingCell]   = useState(null);
  const [fillingEmp, setFillingEmp]     = useState(null);
  const [showUpload, setShowUpload]     = useState(false);

  const { year, month } = useMemo(() => {
    const d = new Date(filters.dateFrom);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [filters.dateFrom]);

  const allEmployees = employeesMap[filters.department] || [];

  useEffect(() => {
    setScheduleMap(generateSchedule(allEmployees, year, month));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, year, month]);

  const visibleEmployees = useMemo(() => {
    if (filters.position === 'all') return allEmployees;
    return allEmployees.filter(e => e.position === filters.position);
  }, [allEmployees, filters.position]);

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

  function handleCellSave({ empId, day, shiftType, value, comment }) {
    setScheduleMap(prev => {
      const empDay = { ...(prev[empId]?.[day] ?? {}) };
      if (shiftType === 'day') {
        empDay.day        = value;
        empDay.dayComment = comment;
      } else {
        empDay.nightShift    = value;
        empDay.nightComment  = comment;
      }
      return { ...prev, [empId]: { ...prev[empId], [day]: empDay } };
    });
  }

  function handleFillApply(empId, updates) {
    setScheduleMap(prev => {
      const empSched = { ...(prev[empId] ?? {}) };
      for (const [d, val] of Object.entries(updates)) {
        empSched[d] = { ...(empSched[d] ?? {}), day: val };
      }
      return { ...prev, [empId]: empSched };
    });
  }

  function handleUpload(grouped) {
    setEmployeesMap(prev => {
      const next = { ...prev };
      for (const [dept, emps] of Object.entries(grouped)) {
        next[dept] = emps;
      }
      return next;
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>График работы сотрудников</h1>
      </header>

      <Filters
        filters={filters}
        onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
        onUploadClick={() => setShowUpload(true)}
      />

      <div className="table-container">
        <ScheduleTable
          employees={visibleEmployees}
          schedule={scheduleMap}
          year={year}
          month={month}
          shiftFilter={filters.shift}
          onCellClick={handleCellClick}
          onFillClick={setFillingEmp}
        />
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#d4edda' }} />
          Р — Работает
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#fff3cd' }} />
          В — Выходной
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#cce5ff' }} />
          О — Отпуск
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#f8d7da' }} />
          Б — Больничный
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#ebebeb', border: '1px solid #c8d0da' }} />
          День (пусто)
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#c8c8c8', border: '1px solid #aaa' }} />
          Ночь (пусто)
        </div>
        <div className="legend-item">
          <span className="comment-dot-demo" />
          Комментарий
        </div>
      </div>

      {editingCell && (
        <CellEditor
          cell={editingCell}
          onSave={handleCellSave}
          onClose={() => setEditingCell(null)}
        />
      )}

      {fillingEmp && (
        <ScheduleFiller
          employee={fillingEmp}
          year={year}
          month={month}
          onApply={handleFillApply}
          onClose={() => setFillingEmp(null)}
        />
      )}

      {showUpload && (
        <EmployeeUpload
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}

import { isWorkValue, splitCode } from '../mockData';

function computeStats(employees, schedule, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return employees.map(emp => {
    const sched = schedule[emp.id] ?? schedule[String(emp.id)] ?? {};
    let dayShifts = 0, nightShifts = 0, hours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = sched[d] ?? {};
      if (isWorkValue(cell.day)) {
        dayShifts += 1;
        hours += splitCode(cell.day).hours ?? 0;
      }
      if (isWorkValue(cell.nightShift)) {
        nightShifts += 1;
        hours += splitCode(cell.nightShift).hours ?? 0;
      }
    }
    return { emp, dayShifts, nightShifts, shifts: dayShifts + nightShifts, hours };
  });
}

export default function EmployeeStats({ employees, schedule, year, month, onClose }) {
  const rows = computeStats(employees, schedule, year, month);
  const totals = rows.reduce((acc, r) => ({
    dayShifts: acc.dayShifts + r.dayShifts,
    nightShifts: acc.nightShifts + r.nightShifts,
    shifts: acc.shifts + r.shifts,
    hours: acc.hours + r.hours,
  }), { dayShifts: 0, nightShifts: 0, shifts: 0, hours: 0 });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-stats">
        <div className="modal-header">
          <div className="modal-title">Статистика по сотрудникам</div>
          <div className="modal-subtitle">{month}.{year} · рабочие смены и часы</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {rows.length === 0 ? (
            <div className="pos-empty">Нет сотрудников</div>
          ) : (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Смен (день)</th>
                  <th>Смен (ночь)</th>
                  <th>Смен всего</th>
                  <th>Часов</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.emp.id}>
                    <td>{r.emp.name}</td>
                    <td>{r.emp.position}</td>
                    <td>{r.dayShifts}</td>
                    <td>{r.nightShifts}</td>
                    <td>{r.shifts}</td>
                    <td>{r.hours}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Итого</td>
                  <td>{totals.dayShifts}</td>
                  <td>{totals.nightShifts}</td>
                  <td>{totals.shifts}</td>
                  <td>{totals.hours}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

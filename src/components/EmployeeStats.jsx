import { isWorkValue, splitCode } from '../mockData';

function getWeekdayCount(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function computeStats(employees, schedule, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const normHours = getWeekdayCount(year, month) * 8;
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
    const deviation = hours - normHours;
    return { emp, dayShifts, nightShifts, shifts: dayShifts + nightShifts, hours, normHours, deviation };
  });
}

export default function EmployeeStats({ employees, schedule, year, month, onClose }) {
  const rows = computeStats(employees, schedule, year, month);
  const normHours = rows[0]?.normHours ?? getWeekdayCount(year, month) * 8;
  const totals = rows.reduce((acc, r) => ({
    dayShifts: acc.dayShifts + r.dayShifts,
    nightShifts: acc.nightShifts + r.nightShifts,
    shifts: acc.shifts + r.shifts,
    hours: acc.hours + r.hours,
    deviation: acc.deviation + r.deviation,
  }), { dayShifts: 0, nightShifts: 0, shifts: 0, hours: 0, deviation: 0 });

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
            <>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Должность</th>
                    <th>Смен (день)</th>
                    <th>Смен (ночь)</th>
                    <th>Смен всего</th>
                    <th>Часов</th>
                    <th>Нормочасы</th>
                    <th>Отклонение</th>
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
                      <td>{r.normHours}</td>
                      <td style={r.deviation > 0 ? { color: '#e53935', fontWeight: 600 } : {}}>
                        {r.deviation > 0 ? `+${r.deviation}` : r.deviation !== 0 ? r.deviation : '—'}
                      </td>
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
                    <td>{normHours * rows.length}</td>
                    <td style={totals.deviation > 0 ? { color: '#e53935', fontWeight: 600 } : {}}>
                      {totals.deviation > 0 ? `+${totals.deviation}` : totals.deviation !== 0 ? totals.deviation : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="stats-footnote">* Нормочасы рассчитаны по рабочим дням месяца (пн–пт) × 8 ч. Праздничные дни не учитываются.</div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

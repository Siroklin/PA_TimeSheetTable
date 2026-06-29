import { isWorkValue, splitCode } from '../mockData';

const PAID_ABSENCE_CODES = new Set(['О', 'Б']);

const PATTERN_HOURS = { '5-0': 8 };
function patternToHours(pattern) {
  return PATTERN_HOURS[pattern] ?? 11;
}

function computeStats(employees, schedule, patterns, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return employees.map(emp => {
    const sched = schedule[emp.id] ?? schedule[String(emp.id)] ?? {};
    const pat = patterns[emp.id] ?? patterns[String(emp.id)];
    const defaultHours = pat ? patternToHours(pat.pattern) : 8;
    let dayShifts = 0, nightShifts = 0, normHours = 0, factHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = sched[d] ?? {};
      for (const [val, isDay] of [[cell.day, true], [cell.nightShift, false]]) {
        if (!val) continue;
        const { code, hours } = splitCode(val);
        if (code === '') {
          const h = hours ?? defaultHours;
          normHours += h;
          factHours += h;
          if (isDay) dayShifts += 1; else nightShifts += 1;
        } else if (PAID_ABSENCE_CODES.has(code)) {
          factHours += hours ?? defaultHours;
        }
      }
    }
    const deviation = factHours - normHours;
    return { emp, dayShifts, nightShifts, shifts: dayShifts + nightShifts, normHours, factHours, deviation };
  });
}

export default function EmployeeStats({ employees, schedule, patterns = {}, year, month, onClose }) {
  const rows = computeStats(employees, schedule, patterns, year, month);
  const totals = rows.reduce((acc, r) => ({
    dayShifts:  acc.dayShifts  + r.dayShifts,
    nightShifts:acc.nightShifts+ r.nightShifts,
    shifts:     acc.shifts     + r.shifts,
    normHours:  acc.normHours  + r.normHours,
    factHours:  acc.factHours  + r.factHours,
    deviation:  acc.deviation  + r.deviation,
  }), { dayShifts: 0, nightShifts: 0, shifts: 0, normHours: 0, factHours: 0, deviation: 0 });

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
                    <th>Нормочасы</th>
                    <th>Факт. часов</th>
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
                      <td>{r.normHours}</td>
                      <td>{r.factHours}</td>
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
                    <td>{totals.normHours}</td>
                    <td>{totals.factHours}</td>
                    <td style={totals.deviation > 0 ? { color: '#e53935', fontWeight: 600 } : {}}>
                      {totals.deviation > 0 ? `+${totals.deviation}` : totals.deviation !== 0 ? totals.deviation : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="stats-footnote">* Нормочасы рассчитаны без учёта праздничных дней Производственного календаря.</div>
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

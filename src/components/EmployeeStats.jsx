import { splitCode } from '../mockData';

const PAID_ABSENCE_CODES = new Set(['О', 'Б']);

// Воспроизводит логику бэкенда _apply_pattern_py — считает норму часов за месяц по паттерну
function calcNormByPattern(pattern, shift, startDateStr, year, month) {
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  let hours = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(year, month - 1, d);
    const dow = cur.getDay(); // 0=Sun, 1=Mon … 6=Sat
    const diff = Math.round((cur - startDate) / 86400000);
    if (pattern === 'ДНОВ') {
      if (diff >= 0 && diff % 4 < 2) hours += 11;
    } else if (pattern === '5-0') {
      if (dow >= 1 && dow <= 5) hours += 8;
    } else if (pattern === '6-1') {
      if (dow >= 1 && dow <= 6) hours += 11;
    } else if (pattern === '2x2') {
      if (diff >= 0 && diff % 4 < 2) hours += 11;
    }
  }
  return hours;
}

function absenceHours(value, defaultHours) {
  if (!value) return 0;
  const { code, hours } = splitCode(value);
  return PAID_ABSENCE_CODES.has(code) ? (hours ?? defaultHours) : 0;
}

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

    // Норма — по паттерну (включая дни, замещённые О/Б)
    const normHours = pat?.start_date
      ? calcNormByPattern(pat.pattern, pat.shift, pat.start_date, year, month)
      : null; // null = паттерн неизвестен

    let dayShifts = 0, nightShifts = 0, factHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = sched[d] ?? {};
      for (const [val, isDay] of [[cell.day, true], [cell.nightShift, false]]) {
        if (!val) continue;
        const { code, hours } = splitCode(val);
        if (code === '') {
          factHours += hours ?? defaultHours;
          if (isDay) dayShifts += 1; else nightShifts += 1;
        }
      }
      // О/Б — один раз за день (не суммируем day+night)
      const dayAbs   = absenceHours(cell.day,        defaultHours);
      const nightAbs = absenceHours(cell.nightShift, defaultHours);
      factHours += Math.max(dayAbs, nightAbs);
    }

    const deviation = normHours !== null ? factHours - normHours : null;
    return { emp, dayShifts, nightShifts, shifts: dayShifts + nightShifts, normHours, factHours, deviation };
  });
}

export default function EmployeeStats({ employees, schedule, patterns = {}, year, month, onClose }) {
  const rows = computeStats(employees, schedule, patterns, year, month);
  const totals = rows.reduce((acc, r) => ({
    dayShifts:   acc.dayShifts   + r.dayShifts,
    nightShifts: acc.nightShifts + r.nightShifts,
    shifts:      acc.shifts      + r.shifts,
    normHours:   acc.normHours !== null && r.normHours !== null ? acc.normHours + r.normHours : null,
    factHours:   acc.factHours   + r.factHours,
    deviation:   acc.deviation !== null && r.deviation !== null ? acc.deviation + r.deviation : null,
  }), { dayShifts: 0, nightShifts: 0, shifts: 0, normHours: 0, factHours: 0, deviation: 0 });

  const fmt = (v, pos = false) => {
    if (v === null) return '—';
    if (pos && v > 0) return `+${v}`;
    return v !== 0 ? String(v) : '—';
  };

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
                      <td>{r.normHours ?? '—'}</td>
                      <td>{r.factHours}</td>
                      <td style={r.deviation > 0 ? { color: '#e53935', fontWeight: 600 } : {}}>
                        {fmt(r.deviation, true)}
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
                    <td>{totals.normHours ?? '—'}</td>
                    <td>{totals.factHours}</td>
                    <td style={totals.deviation > 0 ? { color: '#e53935', fontWeight: 600 } : {}}>
                      {fmt(totals.deviation, true)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="stats-footnote">* Нормочасы — запланированные смены по графику (включая дни отпуска и больничного). Праздничные дни не учитываются.</div>
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

import { splitCode } from '../mockData';

// Единый справочник кодов: описание + участие в фактических часах.
// Нормочасы в этот справочник не входят — они считаются строго по паттерну
// графика сотрудника (2x2/5-0/6-1/ДНОВ), независимо от кодов в ячейках.
// '' — обычная смена (ячейка без буквенного кода, чистое число часов).
const CODE_INFO = [
  { code: '',   label: 'Обычная смена',       fact: true  },
  { code: 'В',  label: 'Выходной',             fact: false },
  { code: 'О',  label: 'Отпуск',               fact: true  },
  { code: 'Б',  label: 'Больничный',           fact: false },
  { code: 'ДО', label: 'Отпуск за свой счёт',  fact: false },
  { code: 'П',  label: 'Прогул',               fact: false },
  { code: 'К',  label: 'Командировка',         fact: true  },
  { code: 'Д',  label: 'Доп. смена',           fact: true  },
  { code: 'С',  label: 'Сверхурочные',         fact: true  },
  { code: 'Ф',  label: 'ФМС',                  fact: false },
  { code: 'У',  label: 'Увольнение',           fact: false },
];
const CODE_RULES = Object.fromEntries(CODE_INFO.map(c => [c.code, c]));

// Коды, которые считаются как «плановый день» по паттерну графика (часы не из
// ячейки, а из графика на этот конкретный день) — статус на весь день, а не на слот.
const PAID_ABSENCE_CODES = new Set(['О', 'Б']);
// Коды, которые считаются по слотам (день/ночь) с часами, введёнными в ячейке.
const PER_SLOT_CODES = new Set(['К', 'Д', 'С']);

// Возвращает {day: hours} — сколько часов по паттерну на каждый день месяца
function buildPatternMap(pattern, startDateStr, year, month) {
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const map = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(year, month - 1, d);
    const dow = cur.getDay();
    const diff = Math.round((cur - startDate) / 86400000);
    let h = 0;
    if (pattern === 'ДНОВ') {
      if (diff >= 0 && diff % 4 < 2) h = 11;
    } else if (pattern === '5-0') {
      if (dow >= 1 && dow <= 5) h = 8;
    } else if (pattern === '6-1') {
      if (dow >= 1 && dow <= 6) h = 11;
    } else if (pattern === '2x2') {
      if (diff >= 0 && diff % 4 < 2) h = 11;
    }
    map[d] = h;
  }
  return map;
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
    const patMap = pat?.start_date
      ? buildPatternMap(pat.pattern, pat.start_date, year, month)
      : null;
    const defaultHours = pat ? patternToHours(pat.pattern) : 8;

    let dayShifts = 0, nightShifts = 0, factHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = sched[d] ?? {};

      // Обычные смены, командировка, доп. смена, сверхурочные — по слотам
      // (день/ночь), часы берутся из введённого в ячейке значения.
      for (const [val, isDay] of [[cell.day, true], [cell.nightShift, false]]) {
        if (!val) continue;
        const { code, hours } = splitCode(val);
        if (code !== '' && !PER_SLOT_CODES.has(code)) continue;
        const rule = CODE_RULES[code];
        const h = hours ?? defaultHours;
        if (rule.fact) factHours += h;
        if (code === '') { if (isDay) dayShifts += 1; else nightShifts += 1; }
      }

      // Отпуск/больничный — статус на весь день, часы берутся по паттерну
      // графика на этот день (выходной по графику → 0ч, рабочий → часы смены)
      const dayAbsCode = PAID_ABSENCE_CODES.has(splitCode(cell.day).code) ? splitCode(cell.day).code
        : PAID_ABSENCE_CODES.has(splitCode(cell.nightShift).code) ? splitCode(cell.nightShift).code
        : null;
      if (dayAbsCode) {
        const rule = CODE_RULES[dayAbsCode];
        const h = patMap ? patMap[d] : defaultHours;
        if (rule.fact) factHours += h;
      }
    }

    // Нормочасы — строго по базовому графику (паттерну) сотрудника, не по
    // отметкам в ячейках. Нет сохранённого паттерна на этот месяц → норма
    // неизвестна (не подставляем никакое значение по умолчанию).
    const normHours = patMap ? Object.values(patMap).reduce((sum, h) => sum + h, 0) : null;
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
              <div className="stats-footnote">
                * Нормочасы считаются строго по базовому графику сотрудника (2×2, 5-0, 6-1, ДНОВ) и не зависят
                от фактических отметок в ячейках. Если график на этот месяц не задан (не внесён через «Граф.»
                и не унаследован при копировании месяца) — нормочасы не считаются, показывается «—».
              </div>

              <details className="stats-legend">
                <summary className="stats-legend-title">Как коды статусов считаются в факте</summary>
                <table className="stats-legend-table">
                  <thead>
                    <tr><th>Код</th><th>Статус</th><th>Учитывается в факт</th></tr>
                  </thead>
                  <tbody>
                    {CODE_INFO.map(c => (
                      <tr key={c.code || 'work'}>
                        <td>{c.code || '—'}</td>
                        <td>{c.label}</td>
                        <td>{c.fact ? 'да' : 'нет'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
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

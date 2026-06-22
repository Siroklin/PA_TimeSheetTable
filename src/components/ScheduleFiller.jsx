import { useState } from 'react';
import { applyPattern, getCellColor } from '../mockData';

const PATTERNS = [
  { id: '2x2',  label: '2×2',  desc: '2 рабочих / 2 выходных (скользящий)' },
  { id: 'ДНОВ', label: 'ДНОВ', desc: 'День → Ночь → Отсыпной → Выходной' },
  { id: '5-0',  label: '5-0',  desc: 'Пн–Пт работа, Сб–Вс выходной' },
  { id: '6-1',  label: '6-1',  desc: 'Пн–Сб работа, Вс выходной' },
];

const DOW_LABELS  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTH_NAMES = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function buildPreview(pattern, year, month, startDate, shift) {
  const updates = applyPattern(pattern, year, month, { startDate, shift });
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: Math.min(14, daysInMonth) }, (_, i) => {
    const d = i + 1;
    const dow = new Date(year, month - 1, d).getDay();
    const u = updates[d] ?? {};
    return { d, dow, day: u.day ?? '', night: u.nightShift ?? '' };
  });
}

export default function ScheduleFiller({ employee, year, month, onApply, onClose }) {
  const [pattern, setPattern] = useState('2x2');
  const [shift, setShift] = useState('day');
  const [startDate, setStartDate] = useState(
    `${year}-${String(month).padStart(2,'0')}-01`
  );

  const parsedStart = new Date(startDate + 'T00:00:00');
  const preview = buildPreview(pattern, year, month, parsedStart, shift);
  const isDNOV = pattern === 'ДНОВ';
  const isCycle = pattern === '2x2' || pattern === 'ДНОВ';

  function handleApply() {
    const updates = applyPattern(pattern, year, month, { startDate: parsedStart, shift });
    const startDateStr = startDate; // already 'YYYY-MM-DD' string
    onApply(employee.id, updates, {
      pattern,
      shift: isDNOV ? null : shift,
      startDate: startDateStr,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-filler">
        <div className="modal-header">
          <div className="modal-title">График — {employee.name}</div>
          <div className="modal-subtitle">{employee.position} · {MONTH_NAMES[month - 1]} {year}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Shift selector — hidden for ДНОВ (fills both columns) */}
          {!isDNOV && (
            <>
              <div className="filler-section-label">Смена сотрудника</div>
              <div className="shift-toggle">
                <button
                  className={`shift-toggle-btn ${shift === 'day' ? 'active' : ''}`}
                  onClick={() => setShift('day')}
                >
                  Дневная смена (Д)
                </button>
                <button
                  className={`shift-toggle-btn ${shift === 'night' ? 'active' : ''}`}
                  onClick={() => setShift('night')}
                >
                  Ночная смена (Н)
                </button>
              </div>
            </>
          )}

          {/* Pattern selector */}
          <div className="filler-section-label">Тип графика</div>
          <div className="pattern-btns">
            {PATTERNS.map(p => (
              <button
                key={p.id}
                className={`pattern-btn ${pattern === p.id ? 'active' : ''}`}
                onClick={() => setPattern(p.id)}
              >
                <span className="pattern-label">{p.label}</span>
                <span className="pattern-desc">{p.desc}</span>
              </button>
            ))}
          </div>

          {/* Start date — applies the pattern only from this date onward,
              leaving earlier days untouched (e.g. mid-month shift change) */}
          <div className="filler-start-row">
            <div className="filler-section-label">
              {isDNOV ? 'Начало цикла (первый рабочий день — Д)'
                : isCycle ? 'Начало цикла (первый рабочий день)'
                : 'Применять график начиная с'}
            </div>
            <input
              type="date"
              className="filler-date-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Preview */}
          <div className="filler-section-label">Предпросмотр (первые 14 дней)</div>
          <div className="filler-preview">
            {preview.map(({ d, dow, day, night }) => (
              <div key={d} className={`preview-cell ${dow === 0 || dow === 6 ? 'preview-weekend' : ''}`}>
                <div className="preview-dow">{DOW_LABELS[dow]}</div>
                <div className="preview-day">{d}</div>
                <div
                  className="preview-val"
                  style={{ backgroundColor: getCellColor(day, false) }}
                  title="День"
                >
                  {day}
                </div>
                <div
                  className="preview-val preview-val-night"
                  style={{ backgroundColor: getCellColor(night, true) }}
                  title="Ночь"
                >
                  {night}
                </div>
              </div>
            ))}
          </div>
          {isDNOV && (
            <div className="filler-legend-hint">
              Верхняя ячейка — день, нижняя — ночь.
              Цикл: <b>11</b> (день) → <b>11</b> (ночь) → <b>В</b> (выходной) → <b>В</b> (выходной)
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button className="btn-save" onClick={handleApply}>Применить</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { applyPattern, getCellColor } from '../mockData';

const PATTERNS = [
  { id: '2x2', label: '2×2', desc: '2 рабочих / 2 выходных (скользящий)' },
  { id: '5-0', label: '5-0', desc: 'Пн–Пт работа, Сб–Вс выходной' },
  { id: '6-1', label: '6-1', desc: 'Пн–Сб работа, Вс выходной' },
];

const DOW_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function buildPreview(pattern, year, month, startDate) {
  const days = applyPattern(pattern, year, month, { startDate });
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: Math.min(14, daysInMonth) }, (_, i) => {
    const d = i + 1;
    const dow = new Date(year, month - 1, d).getDay();
    return { d, dow, val: days[d] ?? '' };
  });
}

export default function ScheduleFiller({ employee, year, month, onApply, onClose }) {
  const [pattern, setPattern] = useState('2x2');
  const defaultStart = new Date(year, month - 1, 1);
  const [startDate, setStartDate] = useState(
    `${year}-${String(month).padStart(2,'0')}-01`
  );

  const parsedStart = new Date(startDate + 'T00:00:00');
  const preview = buildPreview(pattern, year, month, parsedStart);

  function handleApply() {
    const updates = applyPattern(pattern, year, month, { startDate: parsedStart });
    onApply(employee.id, updates);
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

          {/* Start date (only for 2x2) */}
          {pattern === '2x2' && (
            <div className="filler-start-row">
              <div className="filler-section-label">Начало цикла (первый рабочий день)</div>
              <input
                type="date"
                className="filler-date-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                min={`${year}-${String(month).padStart(2,'0')}-01`}
                max={`${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`}
              />
            </div>
          )}

          {/* Preview (first 14 days) */}
          <div className="filler-section-label">Предпросмотр (первые 14 дней)</div>
          <div className="filler-preview">
            {preview.map(({ d, dow, val }) => (
              <div key={d} className={`preview-cell ${dow === 0 || dow === 6 ? 'preview-weekend' : ''}`}>
                <div className="preview-dow">{DOW_LABELS[dow]}</div>
                <div className="preview-day">{d}</div>
                <div
                  className="preview-val"
                  style={{ backgroundColor: getCellColor(val, false) }}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button className="btn-save" onClick={handleApply}>Применить</button>
        </div>
      </div>
    </div>
  );
}

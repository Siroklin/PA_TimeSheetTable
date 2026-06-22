import { useState, useEffect, useRef } from 'react';
import { SHIFT_COLORS, WORK_COLOR, splitCode, applyPattern } from '../mockData';
import { fetchPattern } from '../api';

const WORK = 'WORK'; // sentinel for "code is blank, cell is pure work hours"

const SHIFT_OPTIONS = [
  { value: WORK, label: 'Работает' },
  { value: 'В',  label: 'В — Выходной' },
  { value: 'О',  label: 'О — Отпуск' },
  { value: 'Б',  label: 'Б — Больничный' },
  { value: 'ДО', label: 'ДО — Отпуск за свой счёт' },
  { value: 'П',  label: 'П — Прогул' },
  { value: 'К',  label: 'К — Командировка' },
  { value: 'Ф',  label: 'Ф — ФМС' },
  { value: 'У',  label: 'У — Увольнение' },
  { value: 'Д',  label: 'Д — Доп. смена' },
];

const DAY_NAMES_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function pad2(n) { return String(n).padStart(2, '0'); }

function codeColor(code) {
  return code === WORK ? WORK_COLOR : (SHIFT_COLORS[code] || '#e9ecef');
}

export default function CellEditor({ cell, onSave, onClose }) {
  const initial = splitCode(cell.value);
  const [code, setCode] = useState(initial.code === '' ? WORK : initial.code);
  const [hours, setHours] = useState(initial.hours ?? 8);
  const [comment, setComment] = useState(cell.comment);
  const [deleting, setDeleting] = useState(false);
  const dialogRef = useRef(null);

  const daysInMonth = new Date(cell.year, cell.month, 0).getDate();
  const minDateStr = `${cell.year}-${pad2(cell.month)}-${pad2(cell.day)}`;
  const maxDateStr = `${cell.year}-${pad2(cell.month)}-${pad2(daysInMonth)}`;
  const [endDate, setEndDate] = useState(minDateStr);

  useEffect(() => {
    const init = splitCode(cell.value);
    setCode(init.code === '' ? WORK : init.code);
    setHours(init.hours ?? 8);
    setComment(cell.comment);
    setEndDate(minDateStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell]);

  function handleCodeChange(v) {
    setCode(v);
    if (v === 'У') setEndDate(maxDateStr);
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const dateLabel = (() => {
    const d = new Date(cell.year, cell.month - 1, cell.day);
    return `${cell.day} ${MONTH_NAMES[cell.month - 1]}, ${DAY_NAMES_FULL[d.getDay()]}`;
  })();

  const shiftLabel = cell.shiftType === 'day' ? 'дневная смена' : 'ночная смена';
  const endDay = Number(endDate.split('-')[2]);

  function handleSave() {
    const codeStr = code === WORK ? '' : code;
    const h = code === 'У' ? 0 : (Number(hours) || 0);
    const value = h > 0 ? `${codeStr}${h}` : codeStr;
    onSave({
      empId: cell.empId, day: cell.day, endDay: Math.max(cell.day, endDay),
      shiftType: cell.shiftType, value, comment,
    });
    onClose();
  }

  async function handleDeleteAbsence() {
    setDeleting(true);
    try {
      const rec = await fetchPattern(cell.empId, cell.year, cell.month).catch(() => null);
      let value = '';
      if (rec) {
        const startDate = new Date(rec.start_date + 'T00:00:00');
        const updates = applyPattern(rec.pattern, cell.year, cell.month, { shift: rec.shift, startDate });
        const dayUpdate = updates[cell.day];
        if (dayUpdate) {
          value = cell.shiftType === 'day' ? (dayUpdate.day ?? '') : (dayUpdate.nightShift ?? '');
        }
      }
      onSave({
        empId: cell.empId, day: cell.day, endDay: cell.day,
        shiftType: cell.shiftType, value, comment: '',
      });
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" ref={dialogRef}>
        <div className="modal-header">
          <div className="modal-title">{cell.empName}</div>
          <div className="modal-subtitle">{cell.empPosition} · {dateLabel} · {shiftLabel}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="shift-options">
            {SHIFT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`shift-btn ${code === opt.value ? 'active' : ''}`}
                style={{ backgroundColor: codeColor(opt.value) }}
                onClick={() => handleCodeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {code !== 'У' && (
            <div className="comment-group">
              <label>Часы работы</label>
              <input
                type="number"
                className="comment-input"
                min={0}
                max={24}
                value={hours}
                onChange={e => setHours(e.target.value)}
              />
            </div>
          )}

          <div className="filler-start-row">
            <div className="filler-section-label">По (включительно)</div>
            <input
              type="date"
              className="filler-date-input"
              value={endDate}
              min={minDateStr}
              max={maxDateStr}
              disabled={code === 'У'}
              onChange={e => setEndDate(e.target.value)}
            />
            {endDay > cell.day && (
              <div className="filler-legend-hint">
                Статус будет проставлен с {cell.day} по {endDay} число включительно.
              </div>
            )}
          </div>

          <div className="comment-group">
            <label>Комментарий</label>
            <textarea
              className="comment-input"
              placeholder="Например: Согласован отпуск"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleDeleteAbsence} disabled={deleting}>
            {deleting ? 'Удаление...' : 'Удалить отсутствие'}
          </button>
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button className="btn-save" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { SHIFT_COLORS } from '../mockData';

const SHIFT_OPTIONS = [
  { value: 'Р', label: 'Р — Работает' },
  { value: 'В', label: 'В — Выходной' },
  { value: 'О', label: 'О — Отпуск' },
  { value: 'Б', label: 'Б — Больничный' },
  { value: '',  label: '— Пусто' },
];

const DAY_NAMES_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export default function CellEditor({ cell, onSave, onClose }) {
  const [value, setValue] = useState(cell.value);
  const [comment, setComment] = useState(cell.comment);
  const dialogRef = useRef(null);

  useEffect(() => {
    setValue(cell.value);
    setComment(cell.comment);
  }, [cell]);

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

  function handleSave() {
    onSave({ empId: cell.empId, day: cell.day, shiftType: cell.shiftType, value, comment });
    onClose();
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
                className={`shift-btn ${value === opt.value ? 'active' : ''}`}
                style={value === opt.value ? { backgroundColor: SHIFT_COLORS[opt.value] || '#e9ecef' } : {}}
                onClick={() => setValue(opt.value)}
              >
                {opt.label}
              </button>
            ))}
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
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button className="btn-save" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

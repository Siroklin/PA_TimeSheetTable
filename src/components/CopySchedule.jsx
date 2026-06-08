import { useState } from 'react';
import { copySchedule } from '../api';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function nextMonthOf(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function getYears() {
  const cur = new Date().getFullYear();
  return [cur - 1, cur, cur + 1, cur + 2];
}

export default function CopySchedule({ department, fromYear, fromMonth, onSuccess, onClose }) {
  const def = nextMonthOf(fromYear, fromMonth);
  const [toYear, setToYear]   = useState(def.year);
  const [toMonth, setToMonth] = useState(def.month);
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  async function handleOk() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await copySchedule(department, fromYear, fromMonth, toYear, toMonth);
      setResult(r.copied);
      onSuccess({ year: toYear, month: toMonth });
    } catch {
      setError('Ошибка при копировании. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  const fromLabel = `${MONTHS[fromMonth - 1]} ${fromYear}`;
  const toLabel   = `${MONTHS[toMonth - 1]} ${toYear}`;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-copy">
        <div className="modal-header">
          <div className="modal-title">Копировать расписание</div>
          <div className="modal-subtitle">Отдел: <strong>{department}</strong></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="copy-info">
            Сотрудники и их графики из <strong>{fromLabel}</strong> будут скопированы в выбранный период.
            Скользящие графики (2×2, ДНОВ) продолжат цикл без разрыва.
          </p>

          <div className="copy-period-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Целевой месяц</label>
              <select
                className="form-input"
                value={toMonth}
                onChange={e => setToMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Год</label>
              <select
                className="form-input"
                value={toYear}
                onChange={e => setToYear(Number(e.target.value))}
              >
                {getYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {result !== null && (
            <div className="copy-success">
              Скопировано сотрудников: <strong>{result}</strong> → {toLabel}
            </div>
          )}
          {error && <div className="upload-error-line">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={busy}>Отмена</button>
          <button className="btn-save" onClick={handleOk} disabled={busy || result !== null}>
            {busy ? 'Копирование...' : 'Копировать'}
          </button>
        </div>
      </div>
    </div>
  );
}

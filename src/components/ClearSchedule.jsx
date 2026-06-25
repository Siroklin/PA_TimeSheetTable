import { useState } from 'react';
import { clearDepartmentSchedule } from '../api';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function getYears() {
  const cur = new Date().getFullYear();
  return [cur - 1, cur, cur + 1, cur + 2];
}

export default function ClearSchedule({ departments, currentDepartment, fromYear, fromMonth, onSuccess, onClose }) {
  const [department, setDepartment] = useState(currentDepartment);
  const [year, setYear]   = useState(fromYear);
  const [month, setMonth] = useState(fromMonth);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);

  async function handleClear() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await clearDepartmentSchedule(department, year, month);
      setResult(r.cleared);
      onSuccess();
    } catch {
      setError('Ошибка при очистке. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-copy">
        <div className="modal-header">
          <div className="modal-title">Очистить расписание</div>
          <div className="modal-subtitle">Только для администратора</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="copy-info" style={{ color: '#c0392b', fontWeight: 500 }}>
            Все записи расписания и шаблоны сотрудников выбранного отдела за указанный период будут удалены безвозвратно.
          </p>

          <div className="form-group">
            <label>Отдел</label>
            <select
              className="form-input"
              value={department}
              onChange={e => { setDepartment(e.target.value); setConfirmed(false); setResult(null); }}
            >
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="copy-period-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Месяц</label>
              <select
                className="form-input"
                value={month}
                onChange={e => { setMonth(Number(e.target.value)); setConfirmed(false); setResult(null); }}
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Год</label>
              <select
                className="form-input"
                value={year}
                onChange={e => { setYear(Number(e.target.value)); setConfirmed(false); setResult(null); }}
              >
                {getYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            Подтверждаю удаление расписания «{department}» за {periodLabel}
          </label>

          {result !== null && (
            <div className="copy-success">
              Очищено сотрудников: <strong>{result}</strong>
            </div>
          )}
          {error && <div className="upload-error-line">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={busy}>Отмена</button>
          <button
            className="btn-save"
            style={{ background: '#c0392b' }}
            onClick={handleClear}
            disabled={busy || !confirmed || result !== null}
          >
            {busy ? 'Очистка...' : 'Очистить'}
          </button>
        </div>
      </div>
    </div>
  );
}

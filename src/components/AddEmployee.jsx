import { useState } from 'react';
import { positions } from '../mockData';

export default function AddEmployee({ department, onSuccess, onClose }) {
  const [form, setForm] = useState({
    code: '', name: '', position: positions[0], shift: 'day',
  });
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState(null);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, department }),
      });
      if (!res.ok) throw new Error();
      onSuccess();
      onClose();
    } catch {
      setError('Ошибка при сохранении. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = form.code.trim() && form.name.trim() && form.position && form.shift;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-add-emp">
        <div className="modal-header">
          <div className="modal-title">Добавить сотрудника</div>
          <div className="modal-subtitle">Отдел: <strong>{department}</strong></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Код сотрудника <span className="req">*</span></label>
            <input
              className="form-input"
              value={form.code}
              onChange={e => set('code', e.target.value)}
              placeholder="001"
            />
          </div>

          <div className="form-group">
            <label>ФИО <span className="req">*</span></label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className="form-group">
            <label>Должность <span className="req">*</span></label>
            <select className="form-input" value={form.position} onChange={e => set('position', e.target.value)}>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Смена <span className="req">*</span></label>
            <div className="shift-toggle">
              <button
                className={`shift-toggle-btn ${form.shift === 'day' ? 'active' : ''}`}
                onClick={() => set('shift', 'day')}
              >
                Дневная (Д)
              </button>
              <button
                className={`shift-toggle-btn ${form.shift === 'night' ? 'active' : ''}`}
                onClick={() => set('shift', 'night')}
              >
                Ночная (Н)
              </button>
            </div>
          </div>

          {error && (
            <div className="upload-errors">
              <div className="upload-error-line">{error}</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn-save" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Сохранение...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { addPosition, deletePosition } from '../api';

export default function AddPosition({ department, departments, positions, onSuccess, onClose }) {
  const [selDept, setSelDept] = useState(department);
  const [newPos, setNewPos]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  async function handleAdd() {
    if (!newPos.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addPosition(selDept, newPos.trim());
      setNewPos('');
      onSuccess(selDept);
    } catch (e) {
      setError(e.message.includes('409') ? 'Такая должность уже существует.' : 'Ошибка при добавлении.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pos) {
    if (!confirm(`Удалить должность "${pos.position}"?`)) return;
    try {
      await deletePosition(pos.id);
      onSuccess(selDept);
    } catch {
      setError('Ошибка при удалении.');
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-add-pos">
        <div className="modal-header">
          <div className="modal-title">Управление должностями</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Отдел</label>
            <select
              className="form-input"
              value={selDept}
              onChange={e => { setSelDept(e.target.value); onSuccess(e.target.value); }}
            >
              {(departments || []).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="pos-list">
            {positions.length === 0 && (
              <div className="pos-empty">Нет должностей для этого отдела</div>
            )}
            {positions.map(p => (
              <div key={p.id} className="pos-list-item">
                <span>{p.position}</span>
                <button className="btn-delete-pos" onClick={() => handleDelete(p)}>×</button>
              </div>
            ))}
          </div>

          <div className="pos-add-row">
            <input
              className="form-input"
              placeholder="Новая должность"
              value={newPos}
              onChange={e => setNewPos(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className="btn-save" onClick={handleAdd} disabled={!newPos.trim() || saving}>
              {saving ? '...' : 'Добавить'}
            </button>
          </div>

          {error && <div className="upload-error-line" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

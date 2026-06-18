import { useState } from 'react';
import { addDepartment, deleteDepartment } from '../api';

export default function ManageDepartments({ departments, onSuccess, onClose }) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addDepartment(newName.trim());
      setNewName('');
      onSuccess();
    } catch (e) {
      setError(e.message.includes('409') ? 'Такой отдел уже существует.' : 'Ошибка при добавлении.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Удалить отдел "${name}"?`)) return;
    setError(null);
    try {
      await deleteDepartment(name);
      onSuccess();
    } catch (e) {
      setError(e.message.includes('400') ? 'Нельзя удалить — отдел используется сотрудниками или должностями.' : 'Ошибка при удалении.');
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-add-pos">
        <div className="modal-header">
          <div className="modal-title">Управление отделами</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="pos-list">
            {(departments || []).length === 0 && (
              <div className="pos-empty">Нет отделов</div>
            )}
            {(departments || []).map(d => (
              <div key={d} className="pos-list-item">
                <span>{d}</span>
                <button className="btn-delete-pos" onClick={() => handleDelete(d)}>×</button>
              </div>
            ))}
          </div>

          <div className="pos-add-row">
            <input
              className="form-input"
              placeholder="Новый отдел"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className="btn-save" onClick={handleAdd} disabled={!newName.trim() || saving}>
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

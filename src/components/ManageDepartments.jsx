import { useState } from 'react';
import { addDepartment, deleteDepartment, updateDepartment } from '../api';

export default function ManageDepartments({ departments, onSuccess, onRename, onClose }) {
  const [newName, setNewName]               = useState('');
  const [newNoNightShifts, setNewNoNightShifts] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue]     = useState('');

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addDepartment(newName.trim(), newNoNightShifts);
      setNewName('');
      setNewNoNightShifts(false);
      onSuccess();
    } catch (e) {
      setError(e.message.includes('409') ? 'Такой отдел уже существует.' : 'Ошибка при добавлении.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Вы точно хотите удалить отдел "${name}"? Все данные по отделу будут удалены.`)) return;
    setError(null);
    try {
      await deleteDepartment(name);
      onSuccess();
    } catch (e) {
      setError(e.message.includes('403') ? 'Удалить отдел может только администратор.' : 'Ошибка при удалении.');
    }
  }

  async function handleToggleNoNightShifts(name, value) {
    setError(null);
    try {
      await updateDepartment(name, { no_night_shifts: value });
      onSuccess();
    } catch {
      setError('Не удалось сохранить настройку.');
    }
  }

  function startEdit(name) {
    setError(null);
    setEditingName(name);
    setEditValue(name);
  }

  function cancelEdit() {
    setEditingName(null);
    setEditValue('');
  }

  async function handleRename(name) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === name) { cancelEdit(); return; }
    setError(null);
    try {
      await updateDepartment(name, { name: trimmed });
      cancelEdit();
      onRename?.(name, trimmed);
      onSuccess();
    } catch (e) {
      setError(e.message.includes('409') ? 'Такой отдел уже существует.' : 'Ошибка при переименовании.');
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
              <div key={d.name} className="pos-list-item settings-row">
                {editingName === d.name ? (
                  <input
                    className="form-input"
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(d.name);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onBlur={() => handleRename(d.name)}
                  />
                ) : (
                  <span>{d.name}</span>
                )}
                <label className="dept-no-night-toggle">
                  <input
                    type="checkbox"
                    checked={!!d.no_night_shifts}
                    onChange={e => handleToggleNoNightShifts(d.name, e.target.checked)}
                  />
                  Нет ночных смен
                </label>
                <button className="btn-edit-emp" onClick={() => startEdit(d.name)} title="Переименовать">✎</button>
                <button className="btn-delete-pos" onClick={() => handleDelete(d.name)}>×</button>
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
            <label className="dept-no-night-toggle">
              <input
                type="checkbox"
                checked={newNoNightShifts}
                onChange={e => setNewNoNightShifts(e.target.checked)}
              />
              Нет ночных смен
            </label>
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

import { useState, useEffect, useCallback } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser } from '../api';

const EMPTY_FORM = { name: '', email: '', login: '', password: '', is_admin: false, departments: [] };

export default function UsersAdmin({ departments, currentUserId, onClose }) {
  const [users, setUsers]     = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function startEdit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, login: u.login, password: '', is_admin: u.is_admin, departments: u.departments });
    setError(null);
  }

  function startAdd() {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function toggleDept(dept) {
    setForm(f => ({
      ...f,
      departments: f.departments.includes(dept)
        ? f.departments.filter(d => d !== dept)
        : [...f.departments, dept],
    }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.login.trim()) return;
    if (editingId === 'new' && !form.password) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        await createUser({
          name: form.name.trim(), email: form.email.trim(), login: form.login.trim(),
          password: form.password, is_admin: form.is_admin, departments: form.departments,
        });
      } else {
        const patch = {
          name: form.name.trim(), email: form.email.trim(), login: form.login.trim(),
          is_admin: form.is_admin, departments: form.departments,
        };
        if (form.password) patch.password = form.password;
        await updateUser(editingId, patch);
      }
      cancelForm();
      loadUsers();
    } catch (e) {
      setError(e.message.includes('409') ? 'Такой логин уже существует.' : 'Ошибка при сохранении.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Удалить пользователя "${u.login}"?`)) return;
    setError(null);
    try {
      await deleteUser(u.id);
      loadUsers();
    } catch (e) {
      setError(e.message.includes('400') ? 'Нельзя удалить самого себя.' : 'Ошибка при удалении.');
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-add-pos">
        <div className="modal-header">
          <div className="modal-title">Управление пользователями</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {editingId === null && (
            <>
              <div className="pos-list">
                {users.length === 0 && <div className="pos-empty">Нет пользователей</div>}
                {users.map(u => (
                  <div key={u.id} className="pos-list-item">
                    <span>
                      {u.login} — {u.name} {u.is_admin ? '(админ)' : `(${u.departments.join(', ') || 'без отделов'})`}
                    </span>
                    <span>
                      <button className="btn-delete-pos" onClick={() => startEdit(u)} title="Редактировать">✎</button>
                      <button className="btn-delete-pos" onClick={() => handleDelete(u)} title="Удалить" disabled={u.id === currentUserId}>×</button>
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn-save" onClick={startAdd}>Добавить пользователя</button>
            </>
          )}

          {editingId !== null && (
            <>
              <div className="form-group">
                <label>Имя</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Почта</label>
                <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Логин</label>
                <input className="form-input" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Пароль {editingId !== 'new' && '(оставьте пустым, чтобы не менять)'}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
                  {' '}Администратор
                </label>
              </div>
              <div className="form-group">
                <label>Доступные отделы</label>
                {(departments || []).map(d => (
                  <label key={d} style={{ display: 'block', fontWeight: 400, textTransform: 'none' }}>
                    <input type="checkbox" checked={form.departments.includes(d)} onChange={() => toggleDept(d)} />
                    {' '}{d}
                  </label>
                ))}
              </div>

              {error && <div className="upload-error-line">{error}</div>}

              <div className="pos-add-row">
                <button className="btn-cancel" onClick={cancelForm}>Отмена</button>
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? '...' : 'Сохранить'}
                </button>
              </div>
            </>
          )}

          {error && editingId === null && <div className="upload-error-line">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { departments } from '../mockData';
import { uploadEmployees } from '../api';

const EXAMPLE = `001,Цех №1,Иванов Иван Иванович,Оператор,день
002,Склад,Петрова Мария Сергеевна,Кладовщик,ночь
003,ПроИнокс,Козлов Андрей Павлович,Технолог,день`;

const SHIFT_MAP = {
  'день': 'day', 'дневная': 'day', 'day': 'day', 'д': 'day',
  'ночь': 'night', 'ночная': 'night', 'night': 'night', 'н': 'night',
};

function parseCsv(text) {
  const errors = [];
  const rows = [];

  text.trim().split('\n').forEach((line, idx) => {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 5) {
      errors.push(`Строка ${idx + 1}: ожидается 5 колонок (код,отдел,ФИО,должность,смена)`);
      return;
    }
    const [code, department, name, position, shiftRaw] = parts;
    if (!departments.includes(department)) {
      errors.push(`Строка ${idx + 1}: неизвестный отдел «${department}». Допустимые: ${departments.join(', ')}`);
      return;
    }
    const shift = SHIFT_MAP[shiftRaw.toLowerCase()];
    if (!shift) {
      errors.push(`Строка ${idx + 1}: неизвестная смена «${shiftRaw}». Допустимые: день, ночь`);
      return;
    }
    rows.push({ code, department, name, position, shift });
  });

  return { rows, errors };
}

export default function EmployeeUpload({ onSuccess, onClose }) {
  const [text, setText]       = useState('');
  const [parsed, setParsed]   = useState(null);
  const [errors, setErrors]   = useState([]);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  function handleParse() {
    const { rows, errors } = parseCsv(text);
    setParsed(rows);
    setErrors(errors);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setText(ev.target.result);
      setParsed(null);
      setErrors([]);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleConfirm() {
    if (!parsed || parsed.length === 0) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await uploadEmployees(parsed);
      onSuccess();
      onClose();
    } catch {
      setSaveErr('Ошибка при сохранении. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-upload">
        <div className="modal-header">
          <div className="modal-title">Загрузка списка сотрудников</div>
          <div className="modal-subtitle">Формат: код, отдел, ФИО, должность, смена</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="upload-format-hint">
            <strong>Формат CSV</strong> (запятая как разделитель):
            <pre className="upload-example">{EXAMPLE}</pre>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
              Смена: <strong>день</strong> или <strong>ночь</strong>
            </div>
          </div>

          <div className="upload-actions-row">
            <label className="btn-file-upload">
              Выбрать файл (.csv)
              <input type="file" accept=".csv,.txt" onChange={handleFileChange} hidden />
            </label>
            <span className="upload-or">или вставьте текст ниже</span>
          </div>

          <textarea
            className="comment-input upload-textarea"
            placeholder={EXAMPLE}
            value={text}
            onChange={e => { setText(e.target.value); setParsed(null); setErrors([]); }}
            rows={6}
          />

          <button className="btn-parse" onClick={handleParse} disabled={!text.trim()}>
            Проверить
          </button>

          {errors.length > 0 && (
            <div className="upload-errors">
              {errors.map((e, i) => <div key={i} className="upload-error-line">{e}</div>)}
            </div>
          )}

          {parsed && parsed.length > 0 && errors.length === 0 && (
            <div className="upload-preview">
              <div className="upload-preview-title">Будет загружено: {parsed.length} сотрудников</div>
              <div className="upload-preview-table-wrap">
                <table className="upload-preview-table">
                  <thead>
                    <tr><th>Код</th><th>Отдел</th><th>ФИО</th><th>Должность</th><th>Смена</th></tr>
                  </thead>
                  <tbody>
                    {parsed.map((r, i) => (
                      <tr key={i}>
                        <td>{r.code}</td>
                        <td>{r.department}</td>
                        <td>{r.name}</td>
                        <td>{r.position}</td>
                        <td>{r.shift === 'day' ? 'День' : 'Ночь'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {saveErr && <div className="upload-errors"><div className="upload-error-line">{saveErr}</div></div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>Отмена</button>
          <button
            className="btn-save"
            onClick={handleConfirm}
            disabled={!parsed || parsed.length === 0 || errors.length > 0 || saving}
          >
            {saving ? 'Сохранение...' : 'Загрузить'}
          </button>
        </div>
      </div>
    </div>
  );
}

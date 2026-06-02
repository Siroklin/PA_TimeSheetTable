import { useState } from 'react';
import { departments } from '../mockData';

const EXAMPLE = `001,Цех №1,Иванов Иван Иванович,Оператор
002,Склад,Петрова Мария Сергеевна,Кладовщик
003,ПроИнокс,Козлов Андрей Павлович,Технолог`;

function parseCsv(text) {
  const errors = [];
  const rows = [];
  let nextId = Date.now();

  text.trim().split('\n').forEach((line, idx) => {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 4) {
      errors.push(`Строка ${idx + 1}: ожидается 4 колонки (код,отдел,ФИО,должность)`);
      return;
    }
    const [code, department, name, position] = parts;
    if (!departments.includes(department)) {
      errors.push(`Строка ${idx + 1}: неизвестный отдел «${department}». Допустимые: ${departments.join(', ')}`);
      return;
    }
    rows.push({ id: nextId++, code, department, name, position });
  });

  return { rows, errors };
}

export default function EmployeeUpload({ onUpload, onClose }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);

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

  function handleConfirm() {
    if (!parsed || parsed.length === 0) return;
    // Group by department
    const grouped = {};
    for (const emp of parsed) {
      if (!grouped[emp.department]) grouped[emp.department] = [];
      grouped[emp.department].push({ id: emp.id, code: emp.code, name: emp.name, position: emp.position });
    }
    onUpload(grouped);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-upload">
        <div className="modal-header">
          <div className="modal-title">Загрузка списка сотрудников</div>
          <div className="modal-subtitle">Формат: код, отдел, ФИО, должность</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="upload-format-hint">
            <strong>Формат CSV</strong> (запятая как разделитель):
            <pre className="upload-example">{EXAMPLE}</pre>
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
                    <tr><th>Код</th><th>Отдел</th><th>ФИО</th><th>Должность</th></tr>
                  </thead>
                  <tbody>
                    {parsed.map(r => (
                      <tr key={r.id}>
                        <td>{r.code}</td>
                        <td>{r.department}</td>
                        <td>{r.name}</td>
                        <td>{r.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Отмена</button>
          <button
            className="btn-save"
            onClick={handleConfirm}
            disabled={!parsed || parsed.length === 0 || errors.length > 0}
          >
            Загрузить
          </button>
        </div>
      </div>
    </div>
  );
}

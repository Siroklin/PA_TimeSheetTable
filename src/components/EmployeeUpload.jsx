import { useState } from 'react';
import * as XLSX from 'xlsx';
import { uploadEmployees } from '../api';

const EXAMPLE = `001,Цех №1,Иванов Иван Иванович,Оператор
002,Склад,Петрова Мария Сергеевна,Кладовщик
003,ПроИнокс,Козлов Андрей Павлович,Технолог`;

// Header aliases: Excel column name → internal field
const HEADER_MAP = {
  'код': 'code', 'code': 'code',
  'отдел': 'department', 'department': 'department', 'подразделение': 'department',
  'фио': 'name', 'имя': 'name', 'name': 'name', 'ф.и.о.': 'name',
  'должность': 'position', 'position': 'position',
};

function parseXlsx(buffer, departments) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!raw.length) return { rows: [], errors: ['Файл пустой'] };

  const errors = [];
  const rows = [];

  // Detect if first row is a header
  const firstRow = raw[0].map(c => String(c).trim().toLowerCase());
  const mappedHeaders = firstRow.map(h => HEADER_MAP[h] ?? null);
  const hasHeader = mappedHeaders.some(h => h !== null);

  const dataRows = hasHeader ? raw.slice(1) : raw;
  const fieldOrder = hasHeader
    ? mappedHeaders  // null means skip that column
    : ['code', 'department', 'name', 'position']; // positional fallback

  dataRows.forEach((row, idx) => {
    const lineNum = hasHeader ? idx + 2 : idx + 1;
    const obj = {};
    fieldOrder.forEach((field, i) => {
      if (field) obj[field] = String(row[i] ?? '').trim();
    });

    const { code, department, name, position } = obj;
    if (!code || !department || !name || !position) {
      errors.push(`Строка ${lineNum}: не заполнены обязательные поля (код, отдел, ФИО, должность)`);
      return;
    }
    if (!departments.includes(department)) {
      errors.push(`Строка ${lineNum}: неизвестный отдел «${department}». Допустимые: ${departments.join(', ')}`);
      return;
    }
    rows.push({ code, department, name, position });
  });

  return { rows, errors };
}

function parseCsv(text, departments) {
  const errors = [];
  const rows = [];

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
    rows.push({ code, department, name, position });
  });

  return { rows, errors };
}

export default function EmployeeUpload({ departments, onSuccess, onClose }) {
  const [text, setText]       = useState('');
  const [parsed, setParsed]   = useState(null);
  const [errors, setErrors]   = useState([]);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  function handleParse() {
    const { rows, errors } = parseCsv(text, departments || []);
    setParsed(rows);
    setErrors(errors);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = ev => {
        const { rows, errors: errs } = parseXlsx(new Uint8Array(ev.target.result), departments || []);
        setText('');
        setParsed(rows);
        setErrors(errs);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => {
        setText(ev.target.result);
        setParsed(null);
        setErrors([]);
      };
      reader.readAsText(file, 'utf-8');
    }
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
              Выбрать файл (.xlsx / .csv)
              <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileChange} hidden />
            </label>
            <span className="upload-or">или вставьте CSV текст ниже</span>
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
                    {parsed.map((r, i) => (
                      <tr key={i}>
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

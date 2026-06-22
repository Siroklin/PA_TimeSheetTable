export const positions = [
  'Оператор', 'Технолог', 'Механик', 'Мастер смены', 'Слесарь', 'Кладовщик', 'Менеджер',
];

export const SHIFT_COLORS = {
  'В':  '#fff3cd', // жёлтый — выходной
  'О':  '#cce5ff', // синий — отпуск
  'Б':  '#f8d7da', // красный (розовый) — больничный
  'ДО': '#fde8c8', // оранжевый — отпуск за свой счёт
  'П':  '#ff8787', // красный — прогул
  'К':  '#99e9f2', // голубой — командировка
  'Ф':  '#e8d5f5', // фиолетовый — ФМС
  'У':  '#ff4d4f', // красный — увольнение
  'Д':  '#ffd43b', // золотой — дополнительная смена
};

export const WORK_COLOR = '#d4edda'; // зелёный — работает (часы по графику)

/**
 * Cell values are stored as an optional letter code followed by an optional
 * hour count, e.g. "8", "11", "В", "Д4", "ДО6". Splits them apart.
 */
export function splitCode(value) {
  if (!value) return { code: '', hours: null };
  const m = String(value).match(/^(\D*)(\d+)?$/);
  if (!m) return { code: String(value), hours: null };
  return { code: m[1] || '', hours: m[2] !== undefined ? Number(m[2]) : null };
}

export function isWorkValue(value) {
  if (!value) return false;
  return splitCode(value).code === '';
}

export const DAY_EMPTY_COLOR   = '#ebebeb';
export const NIGHT_EMPTY_COLOR = '#c8c8c8';

export function getCellColor(value, isNight) {
  const emptyColor = isNight ? NIGHT_EMPTY_COLOR : DAY_EMPTY_COLOR;
  if (!value) return emptyColor;
  const { code } = splitCode(value);
  if (code === '') return WORK_COLOR;             // чистое число часов — работает
  return SHIFT_COLORS[code] ?? emptyColor;
}

export function generateSchedule(employeeList, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const schedule = {};
  for (const emp of employeeList) {
    schedule[emp.id] = {};
    for (let d = 1; d <= daysInMonth; d++) {
      schedule[emp.id][d] = { day: '', nightShift: '', dayComment: '', nightComment: '' };
    }
  }
  return schedule;
}

/**
 * Returns per-day update objects { day?, nightShift? } only for days on/after
 * options.startDate. Days before startDate are omitted so the caller can
 * leave them untouched (e.g. switching day→night shift mid-month on a 6-1
 * schedule, or restarting a rolling cycle from a later date).
 *
 * options.shift: 'day' | 'night'  — which column to fill (ignored for ДНОВ)
 * options.startDate: Date          — date from which the schedule applies
 */
export function applyPattern(pattern, year, month, options = {}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const shift = options.shift || 'day';
  const startDate = options.startDate instanceof Date
    ? options.startDate
    : new Date(year, month - 1, 1);
  const result = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date < startDate) continue;

    const dow = date.getDay(); // 0=Sun … 6=Sat
    const diffDays = Math.floor((date - startDate) / 86400000);

    if (pattern === 'ДНОВ') {
      const phase = diffDays % 4;
      // Д=0: рабочий день, Н=1: рабочая ночь, О=2 и В=3: выходные
      switch (phase) {
        case 0: result[d] = { day: '11', nightShift: '' }; break;
        case 1: result[d] = { day: '',   nightShift: '11' }; break;
        case 2: result[d] = { day: 'В',  nightShift: '' };  break;
        case 3: result[d] = { day: 'В',  nightShift: '' };  break;
        default: result[d] = {};
      }
    } else {
      let val = '';
      if (pattern === '5-0') {
        val = (dow >= 1 && dow <= 5) ? '8' : 'В';
      } else if (pattern === '6-1') {
        val = (dow >= 1 && dow <= 6) ? '11' : 'В';
      } else if (pattern === '2x2') {
        val = (diffDays % 4) < 2 ? '11' : 'В';
      }
      // Clear the unused column too, so switching shift mid-month doesn't
      // leave a stale value from the previous shift assignment.
      result[d] = shift === 'day' ? { day: val, nightShift: '' } : { day: '', nightShift: val };
    }
  }
  return result;
}

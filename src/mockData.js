export const positions = [
  'Оператор', 'Технолог', 'Механик', 'Мастер смены', 'Слесарь', 'Кладовщик', 'Менеджер',
];

export const SHIFT_COLORS = {
  '8':  '#d4edda', // зелёный — работает (8ч, график 5-2)
  '11': '#a8d8b9', // зелёный (темнее) — работает (11ч, сменный график)
  'В':  '#fff3cd', // жёлтый — выходной
  'О':  '#cce5ff', // синий — отпуск
  'Б':  '#f8d7da', // красный (розовый) — больничный
  'ДО': '#fde8c8', // оранжевый — отпуск за свой счёт
  'П':  '#ff8787', // красный — прогул
  'К':  '#99e9f2', // голубой — командировка
  'Ф':  '#e8d5f5', // фиолетовый — ФМС
  'У':  '#ced4da', // серый — увольнение
  'Д':  '#ffd43b', // золотой — дополнительная смена
};

export function isWorkValue(value) {
  return value === '8' || value === '11';
}

export const DAY_EMPTY_COLOR   = '#ebebeb';
export const NIGHT_EMPTY_COLOR = '#c8c8c8';

export function getCellColor(value, isNight) {
  if (isNight) return NIGHT_EMPTY_COLOR;          // ночь всегда серая
  if (!value) return DAY_EMPTY_COLOR;
  return SHIFT_COLORS[value] ?? DAY_EMPTY_COLOR;  // день — по статусу
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
 * Returns per-day update objects { day?, nightShift? }.
 * Only the keys present in each object will be overwritten in the schedule.
 *
 * options.shift: 'day' | 'night'  — which column to fill (ignored for ДНОВ)
 * options.startDate: Date          — cycle start date (for 2x2 and ДНОВ)
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
    const dow = date.getDay(); // 0=Sun … 6=Sat
    const diffDays = Math.floor((date - startDate) / 86400000);

    if (pattern === 'ДНОВ') {
      if (diffDays < 0) {
        result[d] = {};
      } else {
        const phase = diffDays % 4;
        // Д=0: рабочий день, Н=1: рабочая ночь, О=2 и В=3: выходные
        switch (phase) {
          case 0: result[d] = { day: '11', nightShift: '' }; break;
          case 1: result[d] = { day: '',   nightShift: '11' }; break;
          case 2: result[d] = { day: 'В',  nightShift: '' };  break;
          case 3: result[d] = { day: 'В',  nightShift: '' };  break;
          default: result[d] = {};
        }
      }
    } else {
      let val = '';
      if (pattern === '5-0') {
        val = (dow >= 1 && dow <= 5) ? '8' : 'В';
      } else if (pattern === '6-1') {
        val = (dow >= 1 && dow <= 6) ? '11' : 'В';
      } else if (pattern === '2x2') {
        if (diffDays < 0) { val = ''; }
        else { val = (diffDays % 4) < 2 ? '11' : 'В'; }
      }
      result[d] = shift === 'day' ? { day: val } : { nightShift: val };
    }
  }
  return result;
}

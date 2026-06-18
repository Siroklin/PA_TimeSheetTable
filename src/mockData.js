export const positions = [
  'Оператор', 'Технолог', 'Механик', 'Мастер смены', 'Слесарь', 'Кладовщик', 'Менеджер',
];

export const SHIFT_COLORS = {
  'Р': '#d4edda',  // зелёный — работает
  'В': '#fff3cd',  // жёлтый — выходной
  'О': '#cce5ff',  // синий — отпуск
  'Б': '#f8d7da',  // красный — больничный
  'С': '#e8d5f5',  // фиолетовый — отсыпной
  'ДО': '#fde8c8', // оранжевый — отпуск за свой счёт
};

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
        // Д=0: рабочий день, Н=1: рабочая ночь, О=2: отсыпной, В=3: выходной
        switch (phase) {
          case 0: result[d] = { day: 'Р', nightShift: '' };  break;
          case 1: result[d] = { day: '',  nightShift: 'Р' }; break;
          case 2: result[d] = { day: 'С', nightShift: '' };  break;
          case 3: result[d] = { day: 'В', nightShift: '' };  break;
          default: result[d] = {};
        }
      }
    } else {
      let val = '';
      if (pattern === '5-0') {
        val = (dow >= 1 && dow <= 5) ? 'Р' : 'В';
      } else if (pattern === '6-1') {
        val = (dow >= 1 && dow <= 6) ? 'Р' : 'В';
      } else if (pattern === '2x2') {
        if (diffDays < 0) { val = ''; }
        else { val = (diffDays % 4) < 2 ? 'Р' : 'В'; }
      }
      result[d] = shift === 'day' ? { day: val } : { nightShift: val };
    }
  }
  return result;
}

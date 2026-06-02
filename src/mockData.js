export const departments = ['Цех №1', 'Цех №2', 'Цех №3', 'Склад', 'ПроИнокс'];

export const positions = [
  'Оператор',
  'Технолог',
  'Механик',
  'Мастер смены',
  'Слесарь',
  'Кладовщик',
  'Менеджер',
];

export const defaultEmployees = {
  'Цех №1': [
    { id: 1,  code: '001', name: 'Иванов Иван Иванович',          position: 'Мастер смены' },
    { id: 2,  code: '002', name: 'Петров Пётр Петрович',           position: 'Оператор' },
    { id: 3,  code: '003', name: 'Сидорова Анна Михайловна',       position: 'Технолог' },
    { id: 4,  code: '004', name: 'Козлов Дмитрий Сергеевич',      position: 'Слесарь' },
    { id: 5,  code: '005', name: 'Новикова Елена Владимировна',    position: 'Оператор' },
  ],
  'Цех №2': [
    { id: 6,  code: '006', name: 'Морозов Алексей Павлович',      position: 'Механик' },
    { id: 7,  code: '007', name: 'Волкова Мария Ивановна',         position: 'Технолог' },
    { id: 8,  code: '008', name: 'Зайцев Николай Андреевич',       position: 'Оператор' },
    { id: 9,  code: '009', name: 'Соколова Ольга Дмитриевна',     position: 'Мастер смены' },
  ],
  'Цех №3': [
    { id: 10, code: '010', name: 'Лебедев Виктор Александрович',   position: 'Слесарь' },
    { id: 11, code: '011', name: 'Орлова Татьяна Николаевна',      position: 'Оператор' },
    { id: 12, code: '012', name: 'Смирнов Андрей Юрьевич',         position: 'Механик' },
  ],
  'Склад': [
    { id: 13, code: '013', name: 'Фёдоров Сергей Иванович',        position: 'Кладовщик' },
    { id: 14, code: '014', name: 'Громова Наталья Петровна',        position: 'Кладовщик' },
  ],
  'ПроИнокс': [
    { id: 15, code: '015', name: 'Белов Артём Викторович',          position: 'Менеджер' },
    { id: 16, code: '016', name: 'Крылова Юлия Андреевна',          position: 'Технолог' },
  ],
};

export const SHIFT_COLORS = {
  'Р': '#d4edda',
  'В': '#fff3cd',
  'О': '#cce5ff',
  'Б': '#f8d7da',
};

// Base empty-cell colors
export const DAY_EMPTY_COLOR   = '#ebebeb';
export const NIGHT_EMPTY_COLOR = '#c8c8c8';

export function getCellColor(value, isNight) {
  if (!value) return isNight ? NIGHT_EMPTY_COLOR : DAY_EMPTY_COLOR;
  return SHIFT_COLORS[value] ?? (isNight ? NIGHT_EMPTY_COLOR : DAY_EMPTY_COLOR);
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

// Fill schedule for one employee according to a pattern
// Returns partial schedule updates { [day]: { day, nightShift } }
export function applyPattern(pattern, year, month, options = {}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay(); // 0=Sun, 1=Mon … 6=Sat
    let val = '';

    if (pattern === '5-0') {
      val = (dow >= 1 && dow <= 5) ? 'Р' : 'В';
    } else if (pattern === '6-1') {
      val = (dow >= 1 && dow <= 6) ? 'Р' : 'В';
    } else if (pattern === '2x2') {
      const startDate = options.startDate || new Date(year, month - 1, 1);
      const diffMs = date - startDate;
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffDays < 0) {
        val = '';
      } else {
        const phase = diffDays % 4;
        val = phase < 2 ? 'Р' : 'В';
      }
    }

    result[d] = val;
  }
  return result;
}

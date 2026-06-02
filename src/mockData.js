export const workshops = ['Цех №1', 'Цех №2', 'Цех №3'];

export const positions = [
  'Оператор',
  'Технолог',
  'Механик',
  'Мастер смены',
  'Слесарь',
];

export const employees = {
  'Цех №1': [
    { id: 1, name: 'Иванов Иван Иванович',        position: 'Мастер смены' },
    { id: 2, name: 'Петров Пётр Петрович',         position: 'Оператор' },
    { id: 3, name: 'Сидорова Анна Михайловна',     position: 'Технолог' },
    { id: 4, name: 'Козлов Дмитрий Сергеевич',    position: 'Слесарь' },
    { id: 5, name: 'Новикова Елена Владимировна',  position: 'Оператор' },
  ],
  'Цех №2': [
    { id: 6, name: 'Морозов Алексей Павлович',    position: 'Механик' },
    { id: 7, name: 'Волкова Мария Ивановна',       position: 'Технолог' },
    { id: 8, name: 'Зайцев Николай Андреевич',     position: 'Оператор' },
    { id: 9, name: 'Соколова Ольга Дмитриевна',   position: 'Мастер смены' },
  ],
  'Цех №3': [
    { id: 10, name: 'Лебедев Виктор Александрович', position: 'Слесарь' },
    { id: 11, name: 'Орлова Татьяна Николаевна',    position: 'Оператор' },
    { id: 12, name: 'Смирнов Андрей Юрьевич',       position: 'Механик' },
  ],
};

export const SHIFT_COLORS = {
  'Р': '#d4edda',
  'В': '#fff3cd',
  'О': '#cce5ff',
  'Б': '#f8d7da',
  '':  '#ffffff',
};

function randomShift() {
  const options = ['Р', 'Р', 'Р', 'Р', 'В', 'О', 'Б', ''];
  return options[Math.floor(Math.random() * options.length)];
}

export function generateSchedule(employeeList, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const schedule = {};
  for (const emp of employeeList) {
    schedule[emp.id] = {};
    for (let d = 1; d <= daysInMonth; d++) {
      schedule[emp.id][d] = {
        day:         randomShift(),
        nightShift:  randomShift(),
        dayComment:   '',
        nightComment: '',
      };
    }
  }
  return schedule;
}

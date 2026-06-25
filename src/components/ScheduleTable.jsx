import { getCellColor, splitCode, SHIFT_COLORS } from '../mockData';

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(year, month, day) {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

export default function ScheduleTable({
  employees, schedule, year, month, readOnly = false,
  onCellClick, onFillClick, onDeleteEmployee, onEditEmployee,
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="table-wrapper">
      <table className="schedule-table">
        <thead>
          <tr className="header-row-days">
            <th className="col-name" rowSpan={2}>ФИО сотрудника</th>
            {days.map(d => (
              <th key={d} colSpan={2} className={`day-header ${isWeekend(year, month, d) ? 'weekend' : ''}`}>
                <div className="day-num">{d}</div>
                <div className="day-name">{DAY_NAMES[getDayOfWeek(year, month, d)]}</div>
              </th>
            ))}
          </tr>
          <tr className="header-row-shifts">
            {days.map(d => (
              <ShiftHeaders key={d} />
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            return (
              <tr key={emp.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="col-name">
                  <div className="emp-info">
                    <div className="emp-left">
                      <span className="emp-name" title={emp.name}>{emp.name}</span>
                      <span className="emp-position" title={emp.position}>({emp.position})</span>
                    </div>
                    <div className="emp-actions">
                      {!readOnly && (
                        <button
                          className="btn-fill-schedule"
                          title="Внести график"
                          onClick={() => onFillClick(emp)}
                        >
                          Граф.
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="btn-edit-emp"
                          title="Изменить данные сотрудника"
                          onClick={() => onEditEmployee(emp)}
                        >
                          ✎
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="btn-delete-emp"
                          title="Удалить сотрудника"
                          onClick={() => onDeleteEmployee(emp)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                {days.map(d => {
                  const cell = schedule[emp.id]?.[d] ?? {};
                  return (
                    <DayCells
                      key={d}
                      dayVal={cell.day ?? ''}
                      nightVal={cell.nightShift ?? ''}
                      dayComment={cell.dayComment ?? ''}
                      nightComment={cell.nightComment ?? ''}
                      isWeekend={isWeekend(year, month, d)}
                      onDayClick={readOnly ? undefined : () => onCellClick(emp, d, 'day')}
                      onNightClick={readOnly ? undefined : () => onCellClick(emp, d, 'night')}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ShiftHeaders() {
  return (
    <>
      <th className="shift-header shift-day">Д</th>
      <th className="shift-header shift-night">Н</th>
    </>
  );
}

function DayCells({ dayVal, nightVal, dayComment, nightComment, isWeekend, onDayClick, onNightClick }) {
  const isTerminated = splitCode(dayVal).code === 'У' || splitCode(nightVal).code === 'У';
  const dayColor = isTerminated ? SHIFT_COLORS['У'] : getCellColor(dayVal, false);
  const nightColor = isTerminated ? SHIFT_COLORS['У'] : getCellColor(nightVal, true);
  return (
    <>
      <td
        className={`cell cell-day ${isWeekend ? 'cell-weekend' : ''}`}
        style={{ backgroundColor: dayColor }}
        onClick={onDayClick}
        title={dayComment || undefined}
      >
        {dayVal}
        {dayComment && <span className="comment-dot" />}
      </td>
      <td
        className="cell cell-night"
        style={{ backgroundColor: nightColor }}
        onClick={onNightClick}
        title={nightComment || undefined}
      >
        {nightVal}
        {nightComment && <span className="comment-dot" />}
      </td>
    </>
  );
}

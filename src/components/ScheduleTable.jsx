import { getCellColor } from '../mockData';

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(year, month, day) {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

export default function ScheduleTable({
  employees, schedule, shifts = {}, year, month, shiftFilter,
  onCellClick, onFillClick, onShiftChange,
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const showDay   = shiftFilter === 'all' || shiftFilter === 'day';
  const showNight = shiftFilter === 'all' || shiftFilter === 'night';

  return (
    <div className="table-wrapper">
      <table className="schedule-table">
        <thead>
          <tr className="header-row-days">
            <th className="col-name" rowSpan={2}>ФИО сотрудника</th>
            {days.map(d => {
              const colSpan = (showDay ? 1 : 0) + (showNight ? 1 : 0);
              if (colSpan === 0) return null;
              const weekend = isWeekend(year, month, d);
              return (
                <th key={d} colSpan={colSpan} className={`day-header ${weekend ? 'weekend' : ''}`}>
                  <div className="day-num">{d}</div>
                  <div className="day-name">{DAY_NAMES[getDayOfWeek(year, month, d)]}</div>
                </th>
              );
            })}
          </tr>
          <tr className="header-row-shifts">
            {days.map(d => (
              <ShiftHeaders key={d} showDay={showDay} showNight={showNight} />
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const empShift = shifts[emp.id] ?? shifts[String(emp.id)] ?? null;
            return (
              <tr key={emp.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="col-name">
                  <div className="emp-info">
                    <div className="emp-left">
                      <span className="emp-name">{emp.name}</span>
                      <span className="emp-position">({emp.position})</span>
                    </div>
                    <div className="emp-actions">
                      <button
                        className={`shift-badge ${empShift === 'night' ? 'shift-badge-night' : 'shift-badge-day'}`}
                        title={empShift === 'night' ? 'Ночная смена — нажмите для смены' : 'Дневная смена — нажмите для смены'}
                        onClick={() => onShiftChange(emp.id, empShift === 'night' ? 'day' : 'night')}
                      >
                        {empShift === 'night' ? 'Н' : 'Д'}
                      </button>
                      <button
                        className="btn-fill-schedule"
                        title="Внести график"
                        onClick={() => onFillClick(emp)}
                      >
                        Граф.
                      </button>
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
                      showDay={showDay}
                      showNight={showNight}
                      isWeekend={isWeekend(year, month, d)}
                      onDayClick={() => onCellClick(emp, d, 'day')}
                      onNightClick={() => onCellClick(emp, d, 'night')}
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

function ShiftHeaders({ showDay, showNight }) {
  return (
    <>
      {showDay   && <th className="shift-header shift-day">Д</th>}
      {showNight && <th className="shift-header shift-night">Н</th>}
    </>
  );
}

function DayCells({ dayVal, nightVal, dayComment, nightComment, showDay, showNight, isWeekend, onDayClick, onNightClick }) {
  return (
    <>
      {showDay && (
        <td
          className={`cell cell-day ${isWeekend ? 'cell-weekend' : ''}`}
          style={{ backgroundColor: getCellColor(dayVal, false) }}
          onClick={onDayClick}
          title={dayComment || undefined}
        >
          {dayVal}
          {dayComment && <span className="comment-dot" />}
        </td>
      )}
      {showNight && (
        <td
          className="cell cell-night"
          style={{ backgroundColor: getCellColor(nightVal, true) }}
          onClick={onNightClick}
          title={nightComment || undefined}
        >
          {nightVal}
          {nightComment && <span className="comment-dot" />}
        </td>
      )}
    </>
  );
}

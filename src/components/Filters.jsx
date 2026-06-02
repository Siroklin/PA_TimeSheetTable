import { departments, positions } from '../mockData';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function getYears() {
  const cur = new Date().getFullYear();
  return [cur - 1, cur, cur + 1, cur + 2];
}

export default function Filters({ filters, period, onFilterChange, onPeriodChange, onUploadClick }) {
  const { department, position, shift } = filters;
  const { year, month } = period;

  function prevMonth() {
    if (month === 1) onPeriodChange({ year: year - 1, month: 12 });
    else onPeriodChange({ year, month: month - 1 });
  }
  function nextMonth() {
    if (month === 12) onPeriodChange({ year: year + 1, month: 1 });
    else onPeriodChange({ year, month: month + 1 });
  }

  return (
    <div className="filters">
      {/* Period navigator */}
      <div className="period-nav">
        <button className="period-arrow" onClick={prevMonth} title="Предыдущий месяц">‹</button>
        <div className="period-selects">
          <select
            className="period-select"
            value={month}
            onChange={e => onPeriodChange({ year, month: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="period-select"
            value={year}
            onChange={e => onPeriodChange({ year: Number(e.target.value), month })}
          >
            {getYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="period-arrow" onClick={nextMonth} title="Следующий месяц">›</button>
      </div>

      <div className="filters-divider" />

      <div className="filter-group">
        <label>Отдел</label>
        <select value={department} onChange={e => onFilterChange({ department: e.target.value })}>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Должность</label>
        <select value={position} onChange={e => onFilterChange({ position: e.target.value })}>
          <option value="all">Все должности</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Смена</label>
        <select value={shift} onChange={e => onFilterChange({ shift: e.target.value })}>
          <option value="all">Все смены</option>
          <option value="day">День</option>
          <option value="night">Ночь</option>
        </select>
      </div>

      <div className="filter-group" style={{ justifyContent: 'flex-end', marginLeft: 'auto' }}>
        <label style={{ visibility: 'hidden' }}>_</label>
        <button className="btn-upload" onClick={onUploadClick}>Загрузить сотрудников</button>
      </div>
    </div>
  );
}

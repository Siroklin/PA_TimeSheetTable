import { workshops, positions } from '../mockData';

export default function Filters({ filters, onChange }) {
  const { workshop, position, shift, dateFrom, dateTo } = filters;

  return (
    <div className="filters">
      <div className="filter-group">
        <label>Производство</label>
        <select value={workshop} onChange={e => onChange({ workshop: e.target.value })}>
          {workshops.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Должность</label>
        <select value={position} onChange={e => onChange({ position: e.target.value })}>
          <option value="all">Все должности</option>
          {positions.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Смена</label>
        <select value={shift} onChange={e => onChange({ shift: e.target.value })}>
          <option value="all">Все смены</option>
          <option value="day">День</option>
          <option value="night">Ночь</option>
        </select>
      </div>

      <div className="filter-group">
        <label>С</label>
        <input
          type="date"
          value={dateFrom}
          onChange={e => onChange({ dateFrom: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label>По</label>
        <input
          type="date"
          value={dateTo}
          onChange={e => onChange({ dateTo: e.target.value })}
        />
      </div>
    </div>
  );
}

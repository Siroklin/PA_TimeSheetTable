import { useState, useRef, useEffect } from 'react';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

function getYears() {
  const cur = new Date().getFullYear();
  return [cur - 1, cur, cur + 1, cur + 2];
}

export default function Filters({
  filters, period, positions, departments, isAdmin, canEdit,
  onFilterChange, onPeriodChange,
  onAddEmployee, onUploadClick, onManagePositions, onManageDepartments, onManageUsers,
  onCopySchedule, onClearSchedule, onShowStats, onLogout,
}) {
  const { department, position, shift } = filters;
  const { year, month } = period;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function prevMonth() {
    if (month === 1) onPeriodChange({ year: year - 1, month: 12 });
    else onPeriodChange({ year, month: month - 1 });
  }
  function nextMonth() {
    if (month === 12) onPeriodChange({ year: year + 1, month: 1 });
    else onPeriodChange({ year, month: month + 1 });
  }

  function menuAction(fn) {
    fn();
    setMenuOpen(false);
  }

  return (
    <div className="filters">
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
        <select value={department} onChange={e => onFilterChange({ department: e.target.value, position: 'all' })}>
          {(departments || []).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Должность</label>
        <select value={position} onChange={e => onFilterChange({ position: e.target.value })}>
          <option value="all">Все должности</option>
          {(positions || []).map(p => <option key={p.id} value={p.position}>{p.position}</option>)}
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

      <div className="filter-group service-menu-wrap" ref={menuRef} style={{ marginLeft: 'auto' }}>
        <label style={{ visibility: 'hidden' }}>_</label>
        <button className="btn-service" onClick={() => setMenuOpen(o => !o)}>
          Сервис <span className="service-arrow">{menuOpen ? '▴' : '▾'}</span>
        </button>
        {menuOpen && (
          <div className="service-dropdown">
            {canEdit && <button onClick={() => menuAction(onAddEmployee)}>Добавить сотрудника</button>}
            {canEdit && <button onClick={() => menuAction(onUploadClick)}>Загрузить сотрудников</button>}
            {canEdit && <div className="service-separator" />}
            {canEdit && <button onClick={() => menuAction(onManagePositions)}>Управление должностями</button>}
            {isAdmin && <button onClick={() => menuAction(onManageDepartments)}>Управление отделами</button>}
            {isAdmin && <button onClick={() => menuAction(onManageUsers)}>Управление пользователями</button>}
            <div className="service-separator" />
            {canEdit && <button onClick={() => menuAction(onCopySchedule)}>Копировать расписание</button>}
            {isAdmin && <button onClick={() => menuAction(onClearSchedule)} style={{ color: '#c0392b' }}>Очистить расписание</button>}
            <button onClick={() => menuAction(onShowStats)}>Статистика по сотрудникам</button>
            {canEdit && <div className="service-separator" />}
            <button onClick={() => menuAction(onLogout)}>Выйти</button>
          </div>
        )}
      </div>
    </div>
  );
}

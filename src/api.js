async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export function fetchEmployees(department) {
  return apiFetch(`/api/employees?department=${encodeURIComponent(department)}`);
}

export function fetchSchedule(department, year, month) {
  return apiFetch(
    `/api/schedule?department=${encodeURIComponent(department)}&year=${year}&month=${month}`
  );
}

export function updateCell(empId, year, month, day, patch) {
  return apiFetch(`/api/schedule/${empId}/${year}/${month}/${day}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function clearSchedule(empId, year, month) {
  return apiFetch(`/api/schedule/${empId}/${year}/${month}`, { method: 'DELETE' });
}

export function deleteEmployee(empId) {
  return apiFetch(`/api/employees/${empId}`, { method: 'DELETE' });
}

export function fetchEmployeeShifts(department, year, month) {
  return apiFetch(
    `/api/employee-shifts?department=${encodeURIComponent(department)}&year=${year}&month=${month}`
  );
}

export function uploadEmployees(employees) {
  return apiFetch('/api/employees/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employees),
  });
}

export function getExportUrl(department, year, month) {
  return `/api/export/excel?department=${encodeURIComponent(department)}&year=${year}&month=${month}`;
}

// ── Department-Position reference ─────────────────────────────────────────────

export function fetchPositions(department) {
  return apiFetch(`/api/positions?department=${encodeURIComponent(department)}`);
}

export function addPosition(department, position) {
  return apiFetch('/api/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ department, position }),
  });
}

export function deletePosition(posId) {
  return apiFetch(`/api/positions/${posId}`, { method: 'DELETE' });
}

// ── Schedule patterns ─────────────────────────────────────────────────────────

export function savePattern(employeeId, year, month, { pattern, shift, startDate }) {
  return apiFetch('/api/schedule-patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: employeeId,
      year, month,
      pattern,
      shift: shift ?? null,
      start_date: startDate,
    }),
  });
}

// ── Copy schedule ─────────────────────────────────────────────────────────────

export function copySchedule(department, fromYear, fromMonth, toYear, toMonth) {
  return apiFetch(
    `/api/copy-schedule?department=${encodeURIComponent(department)}` +
    `&from_year=${fromYear}&from_month=${fromMonth}` +
    `&to_year=${toYear}&to_month=${toMonth}`,
    { method: 'POST' }
  );
}

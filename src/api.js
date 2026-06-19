const TOKEN_KEY = 'st_token';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function login(loginName, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginName, password }),
  });
}

export function fetchMe() {
  return apiFetch('/api/auth/me');
}

// ── Users (admin) ────────────────────────────────────────────────────────────

export function fetchUsers() {
  return apiFetch('/api/users');
}

export function createUser(data) {
  return apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateUser(id, data) {
  return apiFetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteUser(id) {
  return apiFetch(`/api/users/${id}`, { method: 'DELETE' });
}

export function createEmployee(data) {
  return apiFetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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
  const token = getToken();
  return `/api/export/excel?department=${encodeURIComponent(department)}&year=${year}&month=${month}` +
    (token ? `&token=${encodeURIComponent(token)}` : '');
}

// ── Departments reference ──────────────────────────────────────────────────────

export function fetchDepartments() {
  return apiFetch('/api/departments');
}

export function addDepartment(name) {
  return apiFetch('/api/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteDepartment(name) {
  return apiFetch(`/api/departments/${encodeURIComponent(name)}`, { method: 'DELETE' });
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

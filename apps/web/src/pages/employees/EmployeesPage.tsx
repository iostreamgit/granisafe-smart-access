import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { PermissionCode } from '@granisafe/shared';
import { ListPager } from '../../components/ListPager';
import { ApiError, apiGet, apiSend } from '../../lib/api';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useAuthStore } from '../../features/auth/auth-store';
import type { Department, Employee, QrResponse } from '../../features/employees/types';
import styles from './EmployeesPage.module.css';

type Tab = 'employees' | 'departments';

type EmployeesListResponse = {
  data: Employee[];
  meta: { page: number; pageSize: number; total: number };
};

export function EmployeesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const canManageEmployees = useAuthStore((s) => s.hasPermission(PermissionCode.EMPLOYEES_MANAGE));
  const canManageDepartments = useAuthStore((s) =>
    s.hasPermission(PermissionCode.DEPARTMENTS_MANAGE),
  );

  const [tab, setTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [listMeta, setListMeta] = useState({ page: 1, pageSize: 20, total: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const [empForm, setEmpForm] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    departmentId: '',
    shiftStart: '08:00',
    lateGraceMinutes: 10,
    rfidTag: '',
  });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  const loadDepartments = useCallback(async () => {
    if (!accessToken) return;
    const data = await apiGet<Department[]>('/api/v1/departments', accessToken);
    setDepartments(data);
  }, [accessToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, statusFilter, pageSize]);

  const loadEmployees = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (statusFilter) params.set('status', statusFilter);
    const res = await apiGet<EmployeesListResponse>(
      `/api/v1/employees?${params.toString()}`,
      accessToken,
    );
    setEmployees(res.data);
    setListMeta(res.meta);
  }, [accessToken, page, pageSize, debouncedSearch, departmentFilter, statusFilter]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await Promise.all([loadDepartments(), loadEmployees()]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load data');
      }
    })();
  }, [loadDepartments, loadEmployees]);

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ id: d.id, label: `${d.code} — ${d.name}` })),
    [departments],
  );

  async function createEmployee(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    try {
      setError(null);
      const created = await apiSend<Employee & { qr: QrResponse }>(
        'POST',
        '/api/v1/employees',
        accessToken,
        {
          employeeCode: empForm.employeeCode,
          firstName: empForm.firstName,
          lastName: empForm.lastName,
          departmentId: empForm.departmentId || undefined,
          shiftStart: empForm.shiftStart,
          lateGraceMinutes: Number(empForm.lateGraceMinutes),
          rfidTag: empForm.rfidTag || undefined,
        },
      );
      setEmpForm({
        employeeCode: '',
        firstName: '',
        lastName: '',
        departmentId: '',
        shiftStart: '08:00',
        lateGraceMinutes: 10,
        rfidTag: '',
      });
      if (created?.qr) setQr(created.qr);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  }

  async function createDepartment(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    try {
      setError(null);
      await apiSend('POST', '/api/v1/departments', accessToken, deptForm);
      setDeptForm({ name: '', code: '' });
      await loadDepartments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create department failed');
    }
  }

  async function showQr(employee: Employee) {
    if (!accessToken) return;
    try {
      const data = await apiGet<QrResponse>(`/api/v1/employees/${employee.id}/qr`, accessToken);
      setSelected(employee);
      setQr(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load QR');
    }
  }

  async function regenerateQr(employeeId: string) {
    if (!accessToken) return;
    try {
      const data = await apiSend<QrResponse>(
        'POST',
        `/api/v1/employees/${employeeId}/qr/regenerate`,
        accessToken,
      );
      if (data) setQr(data);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'QR regenerate failed');
    }
  }

  async function deactivate(employeeId: string) {
    if (!accessToken) return;
    try {
      await apiSend('POST', `/api/v1/employees/${employeeId}/deactivate`, accessToken);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deactivate failed');
    }
  }

  async function removeDepartment(id: string) {
    if (!accessToken) return;
    try {
      await apiSend('DELETE', `/api/v1/departments/${id}`, accessToken);
      await loadDepartments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete department failed');
    }
  }

  function downloadQr() {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr.qrImageDataUrl;
    link.download = `qr-${selected?.employeeCode ?? qr.employeeId}.png`;
    link.click();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Employees</h2>
          <p>Workforce registry, departments, and QR badges.</p>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === 'employees' ? styles.tabActive : styles.tab}
            onClick={() => setTab('employees')}
          >
            Employees
          </button>
          <button
            type="button"
            className={tab === 'departments' ? styles.tabActive : styles.tab}
            onClick={() => setTab('departments')}
          >
            Departments
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {tab === 'employees' && (
        <>
          <div className={styles.filters}>
            <input
              placeholder="Search name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All departments</option>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {canManageEmployees && (
            <form className={styles.form} onSubmit={createEmployee}>
              <h3>Add employee</h3>
              <div className={styles.formGrid}>
                <input
                  required
                  placeholder="Code (EMP-1042)"
                  value={empForm.employeeCode}
                  onChange={(e) => setEmpForm((f) => ({ ...f, employeeCode: e.target.value }))}
                />
                <input
                  required
                  placeholder="First name"
                  value={empForm.firstName}
                  onChange={(e) => setEmpForm((f) => ({ ...f, firstName: e.target.value }))}
                />
                <input
                  required
                  placeholder="Last name"
                  value={empForm.lastName}
                  onChange={(e) => setEmpForm((f) => ({ ...f, lastName: e.target.value }))}
                />
                <select
                  value={empForm.departmentId}
                  onChange={(e) => setEmpForm((f) => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">No department</option>
                  {departmentOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={empForm.shiftStart}
                  onChange={(e) => setEmpForm((f) => ({ ...f, shiftStart: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={empForm.lateGraceMinutes}
                  onChange={(e) =>
                    setEmpForm((f) => ({ ...f, lateGraceMinutes: Number(e.target.value) }))
                  }
                  placeholder="Grace minutes"
                />
                <input
                  placeholder="RFID tag (optional)"
                  value={empForm.rfidTag}
                  onChange={(e) => setEmpForm((f) => ({ ...f, rfidTag: e.target.value }))}
                />
              </div>
              <button type="submit">Create + generate QR</button>
            </form>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>QR</th>
                <th>RFID</th>
                {canManageEmployees && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.employeeCode}</td>
                  <td>{employee.fullName}</td>
                  <td>{employee.department?.name ?? '—'}</td>
                  <td>
                    <span
                      className={employee.status === 'ACTIVE' ? styles.badgeOk : styles.badgeMuted}
                    >
                      {employee.status}
                    </span>
                  </td>
                  <td>{employee.qrHint ? `…${employee.qrHint}` : '—'}</td>
                  <td>{employee.rfidHint ? `…${employee.rfidHint}` : '—'}</td>
                  {canManageEmployees && (
                    <td className={styles.actions}>
                      <button type="button" onClick={() => void showQr(employee)}>
                        QR
                      </button>
                      <button type="button" onClick={() => void regenerateQr(employee.id)}>
                        Regen
                      </button>
                      {employee.status === 'ACTIVE' && (
                        <button type="button" onClick={() => void deactivate(employee.id)}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!employees.length ? (
                <tr>
                  <td colSpan={canManageEmployees ? 7 : 6}>No employees for these filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <ListPager
            page={listMeta.page}
            pageSize={listMeta.pageSize}
            total={listMeta.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {tab === 'departments' && (
        <>
          {canManageDepartments && (
            <form className={styles.form} onSubmit={createDepartment}>
              <h3>Add department</h3>
              <div className={styles.formGrid}>
                <input
                  required
                  placeholder="Name"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  required
                  placeholder="Code (WELD)"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <button type="submit">Create department</button>
            </form>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Employees</th>
                {canManageDepartments && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td>{dept.code}</td>
                  <td>{dept.name}</td>
                  <td>{dept._count?.employees ?? 0}</td>
                  {canManageDepartments && (
                    <td>
                      <button type="button" onClick={() => void removeDepartment(dept.id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {qr && (
        <div className={styles.modalBackdrop} onClick={() => setQr(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>QR badge {selected ? `· ${selected.fullName}` : ''}</h3>
            <img src={qr.qrImageDataUrl} alt="Employee QR code" />
            <p className={styles.payload}>{qr.qrPayload}</p>
            <div className={styles.actions}>
              <button type="button" onClick={downloadQr}>
                Download PNG
              </button>
              <button type="button" onClick={() => setQr(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

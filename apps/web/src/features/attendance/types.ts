export type AttendanceEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: { id: string; code: string; name: string } | null;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  punchType: string;
  punchedAt: string;
  isLate: boolean;
  source: string;
  employee: AttendanceEmployee;
};

export type AttendanceListResponse = {
  items: AttendanceRecord[];
  page: number;
  pageSize: number;
  total: number;
};

export type OnSiteItem = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: { id: string; code: string; name: string } | null;
  lastEntry: {
    id: string;
    punchedAt: string;
    isLate: boolean;
    source: string;
  };
};

export type OnSiteResponse = {
  count: number;
  items: OnSiteItem[];
};

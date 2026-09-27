export type Department = {
  id: string;
  name: string;
  code: string;
  _count?: { employees: number };
};

export type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  shiftStart: string | null;
  lateGraceMinutes: number;
  departmentId: string | null;
  department: { id: string; name: string; code: string } | null;
  hasQr: boolean;
  qrHint: string | null;
  rfidHint: string | null;
};

export type QrResponse = {
  employeeId: string;
  qrPayload: string;
  qrImageDataUrl: string;
  rotatedAt: string;
  displayHint?: string;
};

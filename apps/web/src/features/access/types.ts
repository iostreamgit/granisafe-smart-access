export type IdentifyResponse = {
  attemptId: string;
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    departmentName: string | null;
  };
  requiredPpe: string[];
  direction: string;
};

export type InspectResponse = {
  attemptId: string;
  decision: string;
  reasons: Array<{ code: string; ppeClass?: string; message: string }>;
  detections: Array<{ ppeClass: string; detected: boolean; confidence: number }>;
  gate: { simulated: boolean; openMs: number };
  attendanceRecorded: boolean;
  attendance: { id: string; punchType: string; isLate: boolean } | null;
};

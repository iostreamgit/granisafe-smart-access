export type DashboardSummary = {
  onSiteCount: number;
  entriesToday: number;
  deniedToday: number;
  aiStatus: 'UP' | 'DOWN' | 'FAKE';
  cameraStatuses: Array<{
    accessPointCode: string;
    status: string;
    lastHeartbeatAt: string;
  }>;
  generatedAt: string;
};

export type LiveAccessEvent = {
  id: string;
  direction: string;
  status: string;
  decision: string | null;
  startedAt: string;
  finishedAt: string | null;
  accessPointCode: string;
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
  };
  reasons?: Array<{ code: string; message: string; ppeClass?: string }>;
};

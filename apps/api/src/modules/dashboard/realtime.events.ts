export const ACCESS_EVENT_CREATED = 'access.event.created';
export const SYSTEM_AI_STATUS = 'system.ai.status';
export const SYSTEM_CAMERA_STATUS = 'system.camera.status';

export type AccessEventCreatedPayload = {
  companyId: string;
  event: {
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
    reasons?: unknown;
  };
};

export type CameraStatusPayload = {
  companyId: string;
  accessPointCode: string;
  status: string;
  lastHeartbeatAt: string;
};

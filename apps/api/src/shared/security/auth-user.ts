export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  roles: string[];
  permissions: string[];
};

import { UserRole } from "./enums/user-role.enum";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}

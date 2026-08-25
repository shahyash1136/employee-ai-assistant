export type UserRole = "employee" | "manager" | "admin";

export interface User {
  userId: string;
  employeeId: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

// What actually goes into the JWT payload — never the passwordHash.
export interface AuthTokenPayload {
  userId: string;
  employeeId: string;
  username: string;
  role: UserRole;
}

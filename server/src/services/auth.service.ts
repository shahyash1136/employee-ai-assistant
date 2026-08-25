import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { csvService } from "./csv.service.js";
import type { User, AuthTokenPayload } from "../types/user.js";

interface UserCsvRow {
  userId: string;
  employeeId: string;
  username: string;
  passwordHash: string;
  role: string;
}

// Fails loudly at startup rather than silently signing tokens with an
// undefined secret if the env var is missing.
const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => {
  throw new Error("JWT_SECRET environment variable is required");
})();

const TOKEN_EXPIRY = "1h";

export class AuthService {
  private async getUsers(): Promise<User[]> {
    return csvService.readCsv<UserCsvRow, User>("users.csv", (row) => ({
      userId: row.userId,
      employeeId: row.employeeId,
      username: row.username,
      passwordHash: row.passwordHash,
      role: row.role as User["role"],
    }));
  }

  async validateCredentials(
    username: string,
    password: string,
  ): Promise<User | null> {
    const users = await this.getUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  issueToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.userId,
      employeeId: user.employeeId,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();

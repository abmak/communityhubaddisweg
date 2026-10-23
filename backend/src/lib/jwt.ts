import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "./errors";

export interface AuthTokenPayload {
  sub: string;
  role: string;
  username: string;
  iat?: number;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: `${env.JWT_EXPIRES_IN_DAYS}d`,
    issuer: "community-hub",
    audience: "community-hub-web",
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "community-hub",
      audience: "community-hub-web",
    });
    if (typeof decoded === "string" || !decoded.sub) {
      throw new Error("Malformed token payload");
    }
    const payload = decoded as jwt.JwtPayload;
    return {
      sub: String(decoded.sub),
      role: String(payload.role ?? "USER"),
      username: String(payload.username ?? ""),
      iat: payload.iat,
    };
  } catch {
    throw ApiError.unauthorized("Your session has expired. Please sign in again.");
  }
}

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { ApiError } from "./errors";
import { logger } from "./logger";

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Sends an SMS through the configured provider.
 * - `console` (default): logs the message for local development.
 * - `knock`: triggers a Knock workflow which owns delivery/branding.
 * - `twilio`: posts directly to Twilio Programmable Messaging.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  if (env.SMS_PROVIDER === "console") {
    logger.info({ to, body }, "SMS (console provider) — message not delivered");
    return;
  }

  if (env.SMS_PROVIDER === "knock") {
    if (!env.KNOCK_API_KEY) {
      throw new ApiError(503, "SMS delivery is not configured", "SMS_NOT_CONFIGURED");
    }
    const response = await fetch(
      `https://api.knock.app/v1/workflows/${encodeURIComponent(env.KNOCK_SMS_WORKFLOW)}/trigger`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.KNOCK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: [to],
          data: { phone: to, message: body },
        }),
      },
    );
    if (!response.ok) {
      logger.error({ status: response.status }, "Knock SMS delivery failed");
      throw new ApiError(502, "Could not send the verification code", "SMS_FAILED");
    }
    return;
  }

  if (env.SMS_PROVIDER === "twilio") {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      throw new ApiError(503, "SMS delivery is not configured", "SMS_NOT_CONFIGURED");
    }
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
      },
    );
    if (!response.ok) {
      logger.error({ status: response.status }, "Twilio SMS delivery failed");
      throw new ApiError(502, "Could not send the verification code", "SMS_FAILED");
    }
  }
}

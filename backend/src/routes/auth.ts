import { randomUUID } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { clearAuthCookies, CSRF_COOKIE, setAuthCookies } from "../lib/cookies";
import { cookieSecure, exposeDevCodes } from "../config/env";
import { selfUserSelect } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateOtp, hashOtp, sendSms, verifyOtpHash } from "../lib/sms";
import { getUnreadCounts } from "../lib/unread";
import { logger } from "../lib/logger";
import { authLimiter, writeLimiter } from "../lib/rate-limit";

export const authRouter = Router();

const phoneField = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use international format, for example +251911234567");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Usernames use 3–24 letters, numbers or underscores"),
  displayName: z.string().trim().min(2, "Tell us your name").max(50),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  phone: phoneField.optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email, username or phone").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

const phoneRequestSchema = z.object({ phone: phoneField });
const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const forgotSchema = z.object({ phone: phoneField });
const resetSchema = z.object({
  phone: phoneField,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: z.string().min(8, "Use at least 8 characters").max(128),
});

async function latestVerification(userId: string, type: "PHONE_VERIFICATION" | "PASSWORD_RESET") {
  return prisma.verificationCode.findFirst({
    where: { userId, type, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

authRouter.get("/csrf", (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    token = randomUUID();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: "lax",
      path: "/",
    });
  }
  res.json({ csrfToken: token });
});

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.userId) {
      res.json({ user: null, unread: { notifications: 0, messages: 0 } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: selfUserSelect,
    });

    if (!user) {
      clearAuthCookies(res);
      res.json({ user: null, unread: { notifications: 0, messages: 0 } });
      return;
    }

    const unread = await getUnreadCounts(user.id);
    res.json({ user, unread });
  }),
);

authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, username, displayName, password, phone, interests } = req.body as z.infer<
      typeof registerSchema
    >;

    const [emailTaken, usernameTaken, phoneTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
      phone ? prisma.user.findUnique({ where: { phone }, select: { id: true } }) : null,
    ]);

    if (emailTaken) throw ApiError.conflict("An account with that email already exists.");
    if (usernameTaken) throw ApiError.conflict("That username is already taken.");
    if (phoneTaken) throw ApiError.conflict("That phone number is already linked to an account.");

    const passwordHash = await bcrypt.hash(password, 12);
    const userCount = await prisma.user.count();

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        phone: phone ?? null,
        interests: interests ?? [],
        role: userCount === 0 ? "ADMIN" : "USER",
        lastSeenAt: new Date(),
      },
      select: selfUserSelect,
    });

    setAuthCookies(res, user);
    res.status(201).json({ user, unread: { notifications: 0, messages: 0 } });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body as z.infer<typeof loginSchema>;
    const normalized = identifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalized }, { username: normalized }, { phone: identifier }],
      },
      select: {
        id: true,
        username: true,
        role: true,
        banned: true,
        passwordHash: true,
      },
    });

    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !validPassword) {
      throw new ApiError(401, "Incorrect sign-in details. Please try again.", "INVALID_CREDENTIALS");
    }
    if (user.banned) {
      throw ApiError.forbidden("This account has been suspended. Contact the community team.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    setAuthCookies(res, user);

    const profile = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: selfUserSelect,
    });
    const unread = await getUnreadCounts(user.id);
    res.json({ user: profile, unread });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.userId) {
      await prisma.user.update({ where: { id: req.userId }, data: { lastSeenAt: new Date() } });
    }
    clearAuthCookies(res);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Phone verification (SMS OTP)
// ---------------------------------------------------------------------------

authRouter.post(
  "/phone/request",
  requireAuth,
  writeLimiter,
  validate(phoneRequestSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as z.infer<typeof phoneRequestSchema>;
    const userId = req.userId!;

    const recent = await prisma.verificationCode.findFirst({
      where: { userId, type: "PHONE_VERIFICATION", createdAt: { gt: new Date(Date.now() - 60_000) } },
      select: { id: true },
    });
    if (recent) {
      throw ApiError.tooMany("A code was just sent. Please wait a minute before requesting another.");
    }

    const otherUser = await prisma.user.findFirst({
      where: { phone, NOT: { id: userId } },
      select: { id: true },
    });
    if (otherUser) throw ApiError.conflict("That phone number is linked to a different account.");

    const code = generateOtp();
    const codeHash = await hashOtp(code);

    await prisma.verificationCode.create({
      data: {
        userId,
        phone,
        codeHash,
        type: "PHONE_VERIFICATION",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    try {
      await sendSms(
        phone,
        `Your አዲስ ገበታ (Addis Gebeta) verification code is ${code}. It expires in 10 minutes.`,
      );
    } catch (error) {
      logger.warn({ err: error }, "Could not deliver phone verification SMS");
      throw error;
    }

    res.json({
      ok: true,
      expiresInMinutes: 10,
      ...(exposeDevCodes ? { devCode: code } : {}),
    });
  }),
);

authRouter.post(
  "/phone/confirm",
  requireAuth,
  validate(codeSchema),
  asyncHandler(async (req, res) => {
    const { code } = req.body as z.infer<typeof codeSchema>;
    const userId = req.userId!;

    const record = await latestVerification(userId, "PHONE_VERIFICATION");
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw ApiError.badRequest("That code has expired. Request a new one.");
    }
    if (record.attempts >= 5) {
      throw ApiError.badRequest("Too many attempts. Request a fresh code.");
    }

    const matches = await verifyOtpHash(code, record.codeHash);
    if (!matches) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest("That code is not correct. Please try again.");
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.verificationCode.updateMany({
        where: { userId, type: "PHONE_VERIFICATION", consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return tx.user.update({
        where: { id: userId },
        data: { phone: record.phone, phoneVerifiedAt: new Date() },
        select: selfUserSelect,
      });
    });

    res.json({ user });
  }),
);

// ---------------------------------------------------------------------------
// Password reset (SMS OTP)
// ---------------------------------------------------------------------------

authRouter.post(
  "/password/forgot",
  authLimiter,
  validate(forgotSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as z.infer<typeof forgotSchema>;

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    let devCode: string | undefined;

    if (user) {
      const code = generateOtp();
      devCode = code;
      await prisma.verificationCode.create({
        data: {
          userId: user.id,
          phone,
          codeHash: await hashOtp(code),
          type: "PASSWORD_RESET",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      logger.info({ phone }, "Password reset code generated");
      await sendSms(
        phone,
        `Your አዲስ ገበታ (Addis Gebeta) password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`,
      );
    }

    // Always answer identically to avoid revealing which numbers are registered.
    res.json({
      ok: true,
      message: "If that number belongs to an account, a reset code is on its way.",
      ...(exposeDevCodes && devCode ? { devCode } : {}),
    });
  }),
);

authRouter.post(
  "/password/reset",
  authLimiter,
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    const { phone, code, newPassword } = req.body as z.infer<typeof resetSchema>;

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) throw ApiError.badRequest("That reset code is not valid.");

    const record = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: "PASSWORD_RESET",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.attempts >= 5) {
      throw ApiError.badRequest("That reset code has expired. Request a new one.");
    }

    const matches = await verifyOtpHash(code, record.codeHash);
    if (!matches) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest("That reset code is not correct.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          passwordChangedAt: new Date(),
        },
      });
      await tx.verificationCode.updateMany({
        where: { userId: user.id, type: "PASSWORD_RESET", consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });

    clearAuthCookies(res);
    res.json({ ok: true, message: "Your password has been updated. You can sign in now." });
  }),
);

import { Request, Response } from "express";
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
} from "../services/userService";
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  TokenError,
  SEVEN_DAYS,
} from "../services/tokenService";
import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import prisma from "../db/prisma";

import bcrypt from "bcryptjs";
import { revokeAllUserRefreshTokens } from "../services/tokenService";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "prod",
  sameSite: "strict" as const,
  maxAge: SEVEN_DAYS,
  path: "/auth/refresh",
};

export async function changePassword(req: Request, res: Response) {
  const userPartial = req.user;

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if(!userPartial) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password required" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userPartial.id },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordValid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!passwordValid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Security: revoke all refresh tokens
    await revokeAllUserRefreshTokens(user.id);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function registerUser(req: Request, res: Response) {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be atleast 8 characters" });
    return;
  }

  try {
    const user = await createUser(email, password, name);
    res.status(201).json({ message: "User created", userId: user.id });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      res.status(409).json({ error: "Email is already in use" });
      return;
    }

    console.error("Register Error", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const user = await findUserByEmail(email);
  const passwordValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "INVALIDHASHFORATTACKPREVENTIONS!!!!");

  if (!user || !passwordValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  try {
    const [accessToken, refreshToken] = await prisma.$transaction(
      async (tx) => {
        const at = await signAccessToken({ sub: user.id, email: user.email, name: user.name });
        const rt = await createRefreshToken(user.id, tx);
        return [at, rt];
      },
    );

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    console.log("Login error: ", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  try {
    const { raw: newRefreshToken, userId } =
      await rotateRefreshToken(refreshToken);
    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);
    res.status(200).json({ accessToken });
  } catch (err) {
    if (err instanceof TokenError) {
      res.clearCookie("refreshToken", { path: "/auth/refresh" });

      if (err.code === "TOKEN_REUSE_DETECTED") {
        res
          .status(401)
          .json({ error: "Security violation detected. Please login again." });
        return;
      }
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }
    console.error("Refresh error: ", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie("refreshToken", { path: "/auth/refresh" });
  res.json({ message: "logged out" });
}



export { registerUser, login, refresh, logout };

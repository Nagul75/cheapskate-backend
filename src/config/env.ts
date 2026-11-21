import "dotenv/config";
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: bool,
    COOKIE_SECURE: bool,
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
    PRIVATE_KEY: z.string().optional(),
    PUBLIC_KEY: z.string().optional(),
    PRIVATE_KEY_PATH: z.string().optional(),
    PUBLIC_KEY_PATH: z.string().optional(),
  })
  .refine((e) => e.PRIVATE_KEY || e.PRIVATE_KEY_PATH, {
    message: "Set PRIVATE_KEY or PRIVATE_KEY_PATH",
    path: ["PRIVATE_KEY"],
  })
  .refine((e) => e.PUBLIC_KEY || e.PUBLIC_KEY_PATH, {
    message: "Set PUBLIC_KEY or PUBLIC_KEY_PATH",
    path: ["PUBLIC_KEY"],
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

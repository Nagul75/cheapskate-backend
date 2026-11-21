import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/authRouter";
import apiRouter from "./routes/ApiRouter";
import cookieParser from "cookie-parser";
import "./types/auth";
import morgan from "morgan";
import { env } from "./config/env";
import { apiLimiter, authLimiter } from "./config/rateLimiter";

const app = express();

app.use(helmet());
app.use(cors({
    origin: env.CORS_ORIGINS,
    credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/auth", authLimiter, authRouter);
app.use("/api", apiLimiter, apiRouter);

export default app;

import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/authRouter";
import apiRouter from "./routes/ApiRouter";
import cookieParser from "cookie-parser";
import "./types/auth";
import morgan from "morgan";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/auth", authRouter);
app.use("/api", apiRouter);

export default app;

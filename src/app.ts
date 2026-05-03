import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { connectDB } from "./config/db.js";
import { startMonthlyBalanceEmailWorker } from "./workers/monthlyBalanceEmail.worker.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use("/", router);
const startServer = async () => {
  await connectDB();

  startMonthlyBalanceEmailWorker();

  const server = app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });

  function cleanup() {
    server.close(() => process.exit(0));
  }

  ["SIGINT", "SIGTERM"].forEach((event) => {
    process.on(event, cleanup);
  });
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});

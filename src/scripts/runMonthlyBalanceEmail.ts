import "dotenv/config";
import { connectDB } from "../config/db.js";
import { runMonthlyBalanceEmailJob } from "../services/email/monthlyBalanceReport.job.js";

const main = async () => {
  await connectDB();
  const result = await runMonthlyBalanceEmailJob();
  console.log(result);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

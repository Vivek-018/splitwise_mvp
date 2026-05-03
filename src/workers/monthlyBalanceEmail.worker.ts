import cron from "node-cron";
import { runMonthlyBalanceEmailJob } from "../services/email/monthlyBalanceReport.job.js";

/**
 * Sends one balance-summary email per active user per calendar month.
 * Default schedule: 09:00 on the 1st of each month (server local time).
 * The email covers the previous month label; balances are current totals from the DB.
 */
export const startMonthlyBalanceEmailWorker = () => {
  if (process.env.MONTHLY_BALANCE_EMAIL_ENABLED === "false") {
    console.log("Monthly balance email worker is disabled (MONTHLY_BALANCE_EMAIL_ENABLED=false).");
    return;
  }

  const expression =
    process.env.MONTHLY_BALANCE_EMAIL_CRON?.trim() || "0 9 1 * *";

  cron.schedule(expression, async () => {
    try {
      await runMonthlyBalanceEmailJob();
    } catch (error) {
      console.error("Monthly balance email cron run failed:", error);
    }
  });

  console.log(
    `Monthly balance email worker scheduled with cron "${expression}".`,
  );
};

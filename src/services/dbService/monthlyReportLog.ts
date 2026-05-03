import { and, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { monthlyBalanceReportSent } from "../../models/schema";

export default class MonthlyReportLog {
  static wasSent = async (userId: string, reportPeriod: string) => {
    const row = await db.query.monthlyBalanceReportSent.findFirst({
      where: and(
        eq(monthlyBalanceReportSent.userId, userId),
        eq(monthlyBalanceReportSent.reportPeriod, reportPeriod),
      ),
    });
    return !!row;
  };

  static markSent = async (userId: string, reportPeriod: string) => {
    await db.insert(monthlyBalanceReportSent).values({ userId, reportPeriod });
  };
}

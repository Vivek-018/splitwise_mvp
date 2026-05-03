import { eq, inArray } from "drizzle-orm";
import { createMailTransport } from "../../config/mailer";
import { db } from "../../config/db";
import { users } from "../../models/schema";
import { UserAccountStatus } from "../../enums";
import Balance from "../dbService/balance";
import MonthlyReportLog from "../dbService/monthlyReportLog";
import {
  buildMonthlyBalanceEmailHtml,
  type BalanceLine,
} from "./monthlyBalanceHtml";

/** Previous calendar month as YYYY-MM (used when the job runs on the 1st). */
export const getPreviousMonthPeriod = (now: Date = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export const runMonthlyBalanceEmailJob = async (now: Date = new Date()) => {
  const transport = createMailTransport();
  const from = process.env.SMTP_FROM;

  if (!transport || !from) {
    console.warn(
      "Monthly balance emails skipped: set SMTP_HOST and SMTP_FROM (and SMTP credentials if required).",
    );
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const reportPeriod = getPreviousMonthPeriod(now);
  const recipientRows = await db.query.users.findMany({
    where: eq(users.accountStatus, UserAccountStatus.ACTIVE),
    columns: {
      id: true,
      name: true,
      email: true,
      defaultCurrency: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of recipientRows) {
    if (await MonthlyReportLog.wasSent(user.id, reportPeriod)) {
      skipped++;
      continue;
    }

    try {
      const rawLines = await Balance.getMyBalances(user.id);
      const otherIds = [...new Set(rawLines.map((l) => l.withUser))];

      let nameById = new Map<string, string>();
      if (otherIds.length > 0) {
        const others = await db.query.users.findMany({
          where: inArray(users.id, otherIds),
          columns: { id: true, name: true },
        });
        nameById = new Map(others.map((o) => [o.id, o.name]));
      }

      const lines: BalanceLine[] = rawLines.map((l) => ({
        counterpartyLabel: nameById.get(l.withUser) ?? l.withUser,
        amount: l.amount,
      }));

      const html = buildMonthlyBalanceEmailHtml({
        userName: user.name,
        reportPeriod,
        currency: user.defaultCurrency,
        lines,
      });

      await transport.sendMail({
        from,
        to: user.email,
        subject: `Balance summary — ${reportPeriod}`,
        html,
      });

      await MonthlyReportLog.markSent(user.id, reportPeriod);
      sent++;
    } catch (err) {
      failed++;
      console.error(
        `Monthly balance email failed for user ${user.id}:`,
        err,
      );
    }
  }

  console.log(
    `Monthly balance emails (${reportPeriod}): sent=${sent}, skipped=${skipped}, failed=${failed}`,
  );
  return { sent, skipped, failed };
};

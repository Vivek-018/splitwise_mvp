export type BalanceLine = {
  counterpartyLabel: string;
  /** Positive = they owe you; negative = you owe them (same as API). */
  amount: number;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatMoney = (value: number, currency: string) =>
  `${currency} ${value.toFixed(2)}`;

export const buildMonthlyBalanceEmailHtml = (params: {
  userName: string;
  reportPeriod: string;
  currency: string;
  lines: BalanceLine[];
}) => {
  const { userName, reportPeriod, currency, lines } = params;

  let totalOwedToYou = 0;
  let totalYouOwe = 0;
  for (const line of lines) {
    if (line.amount > 0) totalOwedToYou += line.amount;
    if (line.amount < 0) totalYouOwe += -line.amount;
  }
  const net = totalOwedToYou - totalYouOwe;

  const rows =
    lines.length === 0
      ? `<tr><td colspan="2" style="padding:12px;border:1px solid #e5e7eb;">No open balances right now.</td></tr>`
      : lines
          .map((line) => {
            const label =
              line.amount >= 0 ? "Owes you" : "You owe";
            const abs = Math.abs(line.amount);
            return `<tr>
              <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(line.counterpartyLabel)}</td>
              <td style="padding:10px;border:1px solid #e5e7eb;">${label}: ${formatMoney(abs, currency)}</td>
            </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,Segoe UI,sans-serif;color:#111827;background:#f9fafb;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:18px;font-weight:600;">Hi ${escapeHtml(userName)},</p>
        <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">
          Here is your balance summary for <strong>${escapeHtml(reportPeriod)}</strong>.
          Amounts use your default currency (${escapeHtml(currency)}). Totals match your live balance in the app.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#4b5563;">Total others owe you</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${formatMoney(totalOwedToYou, currency)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4b5563;">Total you owe others</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${formatMoney(totalYouOwe, currency)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4b5563;">Net</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${formatMoney(net, currency)}</td>
          </tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Per person</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          ${rows}
        </table>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">This is an automated monthly email.</p>
      </td></tr>
    </table>
  </body>
</html>`;
};

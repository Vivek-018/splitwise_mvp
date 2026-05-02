import { eq, or, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { balances } from "../../models/schema";

const asServiceError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) return new Error(`${fallbackMessage}: ${error.message}`);
  return new Error(`${fallbackMessage}: ${String(error)}`);
};

export default class Balance {
  // ─── Repository-level methods ─────────────────────────────────────────────

  /**
   * Always stores pair with lower UUID first to enforce unique constraint.
   * amount > 0 means userId is owed by otherUserId.
   */
  static updateBalance = async (
    payerId: string,
    otherId: string,
    amount: number,
    dbExecutor: any = db,
  ) => {
    try {
      const [userId, otherUserId, adjustedAmount] =
        payerId < otherId
          ? [payerId, otherId, amount]
          : [otherId, payerId, -amount];

      await dbExecutor
        .insert(balances)
        .values({
          userId,
          otherUserId,
          amount: String(adjustedAmount),
        })
        .onConflictDoUpdate({
          target: [balances.userId, balances.otherUserId],
          set: {
            amount: sql`${balances.amount} + ${adjustedAmount}`,
          },
        });
    } catch (error) {
      throw asServiceError(error, "Failed to update balance");
    }
  };

  static findByUser = async (userId: string) => {
    try {
      return db.query.balances.findMany({
        where: or(
          eq(balances.userId, userId),
          eq(balances.otherUserId, userId),
        ),
      });
    } catch (error) {
      throw asServiceError(error, "Failed to fetch user balances");
    }
  };

  // ─── Service-level methods ────────────────────────────────────────────────

  static getMyBalances = async (userId: string) => {
    try {
      const rows = await Balance.findByUser(userId);

      return rows
        .map((row) => {
          if (row.userId === userId) {
            return {
              withUser: row.otherUserId,
              amount: parseFloat(row.amount),
              // positive = they owe you | negative = you owe them
            };
          } else {
            return {
              withUser: row.userId,
              amount: -parseFloat(row.amount),
            };
          }
        })
        .filter((b) => b.amount !== 0);
    } catch (error) {
      throw asServiceError(error, "Failed to fetch user balances");
    }
  };
}

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { expenses, expenseMembers, NewExpense } from "../../models/schema";
import { ApiError } from "../../utils/ApiError";
import { CreateExpenseBody, UpdateExpenseBody } from "../../interfaces/index";
import Balance from "./balance";

export default class Expense {
  static findById = async (id: string) => {
    return await db.query.expenses.findFirst({
      where: eq(expenses.id, id),
      with: { expenseMembers: true },
    });
  };

  static findByIdForUser = async (expenseId: string, userId: string) => {
    const member = await db.query.expenseMembers.findFirst({
      where: and(
        eq(expenseMembers.expenseId, expenseId),
        eq(expenseMembers.userId, userId),
      ),
    });
    if (!member) return null;
    return Expense.findById(expenseId);
  };

  static insertMembers = async (
    members: { expenseId: string; userId: string; shareAmount: string }[],
  ) => {
    await db.insert(expenseMembers).values(members);
  };

  static deleteMembersByExpenseId = async (expenseId: string) => {
    await db
      .delete(expenseMembers)
      .where(eq(expenseMembers.expenseId, expenseId));
  };

  static getActivityLogQuery = async (userId: string, from: Date, to: Date) => {
    const memberRows = await db.query.expenseMembers.findMany({
      where: eq(expenseMembers.userId, userId),
    });
    const expenseIds = memberRows.map((m) => m.expenseId);
    if (expenseIds.length === 0) return [];

    return db.query.expenses.findMany({
      where: and(
        inArray(expenses.id, expenseIds),
        gte(expenses.date, from),
        lte(expenses.date, to),
      ),
      with: { expenseMembers: true },
      orderBy: (expenses, { desc }) => [desc(expenses.date)],
    });
  };

  // ─── Service-level methods ───────────────────────────────────────────────────

  static createExpense = async (payerId: string, body: CreateExpenseBody) => {
    try {
      if (!body.memberIds.includes(payerId)) {
        throw new ApiError(400, "Payer must be included in members");
      }
      if (body.memberIds.length < 2) {
        throw new ApiError(400, "Expense must have at least 2 members");
      }

      const shareAmount = (body.amount / body.memberIds.length).toFixed(2);

      const [expense] = await db
        .insert(expenses)
        .values({
          name: body.name,
          amount: String(body.amount),
          currency: body.currency,
          payerId,
          date: new Date(body.date),
        })
        .returning();

      await Expense.insertMembers(
        body.memberIds.map((userId) => ({
          expenseId: expense.id,
          userId,
          shareAmount,
        })),
      );

      // Update balances: payer is owed by everyone else
      const others = body.memberIds.filter((id) => id !== payerId);
      for (const otherId of others) {
        await Balance.updateBalance(payerId, otherId, parseFloat(shareAmount));
      }

      return await Expense.findById(expense.id);
    } catch (error) {
      console.error(error);
      throw Error
    }
  };

  static getExpense = async (expenseId: string, userId: string) => {
    try {
      const expense = await Expense.findByIdForUser(expenseId, userId);
      if (!expense)
        throw new ApiError(404, "Expense not found or access denied");
      return expense;
    } catch (error) {
      throw new Error(
        `Failed to fetch expense: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  static updateExpense = async (
    expenseId: string,
    userId: string,
    body: UpdateExpenseBody,
  ) => {
    try {
      const existing = await Expense.findByIdForUser(expenseId, userId);
      if (!existing)
        throw new ApiError(404, "Expense not found or access denied");
      if (existing.payerId !== userId) {
        throw new ApiError(403, "Only the payer can update this expense");
      }

      // Reverse old balance impact
      await Expense._reverseBalances(existing);

      const newAmount = body.amount ?? parseFloat(existing.amount);
      const newMembers =
        body.memberIds ??
        (existing.expenseMembers as { userId: string }[]).map((m) => m.userId);
      const shareAmount = (newAmount / newMembers.length).toFixed(2);

      // Delete old members, insert new ones
      await Expense.deleteMembersByExpenseId(expenseId);
      await Expense.insertMembers(
        newMembers.map((uid: string) => ({
          expenseId,
          userId: uid,
          shareAmount,
        })),
      );

      await db
        .update(expenses)
        .set({
          name: body.name ?? existing.name,
          amount: String(newAmount),
          currency: body.currency ?? existing.currency,
          date: body.date ? new Date(body.date) : existing.date,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId));

      // Apply new balances
      const others = newMembers.filter((id: string) => id !== existing.payerId);
      for (const otherId of others) {
        await Balance.updateBalance(
          existing.payerId,
          otherId,
          parseFloat(shareAmount),
        );
      }

      return Expense.findById(expenseId);
    } catch (error) {
      throw new Error(
        `Failed to update expense: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  static deleteExpense = async (expenseId: string, userId: string) => {
    try {
      const existing = await Expense.findByIdForUser(expenseId, userId);
      if (!existing)
        throw new ApiError(404, "Expense not found or access denied");
      if (existing.payerId !== userId) {
        throw new ApiError(403, "Only the payer can delete this expense");
      }

      await Expense._reverseBalances(existing);
      await db.delete(expenses).where(eq(expenses.id, expenseId)); // cascades members
    } catch (error) {
      throw new Error(
        `Failed to delete expense: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  static getActivityLog = async (
    userId: string,
    range: "current" | "last" | "custom",
    from?: string,
    to?: string,
  ) => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (range === "current") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
      } else if (range === "last") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else {
        if (!from || !to) {
          throw new ApiError(400, "from and to are required for custom range");
        }
        startDate = new Date(from);
        endDate = new Date(to);
      }

      return Expense.getActivityLogQuery(userId, startDate, endDate);
    } catch (error) {
      throw new Error(
        `Failed to fetch activity log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // ─── Internal helper ─────────────────────────────────────────────────────────

  static _reverseBalances = async (expense: {
    payerId: string;
    expenseMembers: { userId: string; shareAmount: string }[];
  }) => {
    try {
      const others = expense.expenseMembers.filter(
        (m) => m.userId !== expense.payerId,
      );
      for (const m of others) {
        await Balance.updateBalance(
          expense.payerId,
          m.userId,
          -parseFloat(m.shareAmount),
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to reverse balances: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../config/db";
import { expenses, expenseMembers } from "../../models/schema";
import { ApiError } from "../../utils/ApiError";
import { CreateExpenseBody, UpdateExpenseBody } from "../../interfaces/index";
import Balance from "./balance";

const asServiceError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new Error(`${fallbackMessage}: ${error.message}`);
  return new Error(`${fallbackMessage}: ${String(error)}`);
};

export default class Expense {
  static getMembersByExpenseIds = async (expenseIds: string[]) => {
    if (expenseIds.length === 0) return [];
    return db.query.expenseMembers.findMany({
      where: inArray(expenseMembers.expenseId, expenseIds),
    });
  };

  static enrichExpensesWithMembers = async (
    baseExpenses: Array<Record<string, any>>,
  ): Promise<any[]> => {
    if (baseExpenses.length === 0) return [];
    const expenseIds = baseExpenses.map((expense) => expense.id);
    const members = await Expense.getMembersByExpenseIds(expenseIds);
    const membersByExpense = new Map<string, typeof members>();

    for (const member of members) {
      const existing = membersByExpense.get(member.expenseId) ?? [];
      existing.push(member);
      membersByExpense.set(member.expenseId, existing);
    }

    return baseExpenses.map((expense) => ({
      ...expense,
      expenseMembers: membersByExpense.get(expense.id) ?? [],
    }));
  };

  static findById = async (id: string): Promise<any | null> => {
    const expense = await db.query.expenses.findFirst({
      where: eq(expenses.id, id),
    });
    if (!expense) return null;
    const [enriched] = await Expense.enrichExpensesWithMembers([expense]);
    return enriched;
  };

  static findByIdForUser = async (
    expenseId: string,
    userId: string,
  ): Promise<any | null> => {
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
    dbExecutor: any = db,
  ) => {
    await dbExecutor.insert(expenseMembers).values(members);
  };

  static deleteMembersByExpenseId = async (
    expenseId: string,
    dbExecutor: any = db,
  ) => {
    await dbExecutor
      .delete(expenseMembers)
      .where(eq(expenseMembers.expenseId, expenseId));
  };

  static getActivityLogQuery = async (
    userId: string,
    from: Date,
    to: Date,
  ): Promise<any[]> => {
    const memberRows = await db.query.expenseMembers.findMany({
      where: eq(expenseMembers.userId, userId),
    });
    const expenseIds = memberRows.map((m) => m.expenseId);
    if (expenseIds.length === 0) return [];

    const expenseRows = await db.query.expenses.findMany({
      where: and(
        inArray(expenses.id, expenseIds),
        gte(expenses.date, from),
        lte(expenses.date, to),
      ),
      orderBy: (expenses, { desc }) => [desc(expenses.date)],
    });
    return Expense.enrichExpensesWithMembers(expenseRows);
  };

  static createExpense = async (payerId: string, body: CreateExpenseBody) => {
    try {
      const parsedAmount = Number(body.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new ApiError(400, "amount must be a valid number greater than 0");
      }
      const parsedDate = new Date(body.date);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new ApiError(400, "date must be a valid ISO date");
      }
      if (!body.memberIds.includes(payerId)) {
        throw new ApiError(400, "Payer must be included in members");
      }
      if (body.memberIds.length < 2) {
        throw new ApiError(400, "Expense must have at least 2 members");
      }
      const uniqueMemberIds = [...new Set(body.memberIds)];
      if (uniqueMemberIds.length !== body.memberIds.length) {
        throw new ApiError(400, "Duplicate members are not allowed");
      }

      const shareAmount = (parsedAmount / uniqueMemberIds.length).toFixed(2);

      const expense = await db.transaction(async (tx) => {
        const [createdExpense] = await tx
          .insert(expenses)
          .values({
            name: body.name,
            amount: String(parsedAmount),
            currency: body.currency,
            payerId,
            date: parsedDate,
          })
          .returning();

        await Expense.insertMembers(
          uniqueMemberIds.map((userId) => ({
            expenseId: createdExpense.id,
            userId,
            shareAmount,
          })),
          tx,
        );

        const others = uniqueMemberIds.filter((id) => id !== payerId);
        for (const otherId of others) {
          await Balance.updateBalance(
            payerId,
            otherId,
            parseFloat(shareAmount),
            tx,
          );
        }

        return createdExpense;
      });

      return await Expense.findById(expense.id);
    } catch (error) {
      console.error("Expense.createExpense failed:", error);
      throw asServiceError(error, "Failed to create expense");
    }
  };

  static getExpense = async (expenseId: string, userId: string) => {
    try {
      const expense = await Expense.findByIdForUser(expenseId, userId);
      if (!expense)
        throw new ApiError(404, "Expense not found or access denied");
      return expense;
    } catch (error) {
      throw asServiceError(error, "Failed to fetch expense");
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

      const newAmount = body.amount ?? parseFloat(existing.amount);
      if (!Number.isFinite(newAmount) || newAmount <= 0) {
        throw new ApiError(400, "amount must be a valid number greater than 0");
      }
      const parsedUpdatedDate = body.date ? new Date(body.date) : existing.date;
      if (Number.isNaN(parsedUpdatedDate.getTime())) {
        throw new ApiError(400, "date must be a valid ISO date");
      }
      const rawMembers =
        body.memberIds ??
        (existing.expenseMembers as { userId: string }[]).map((m) => m.userId);
      const newMembers = [...new Set(rawMembers)];
      if (!newMembers.includes(existing.payerId)) {
        throw new ApiError(400, "Payer must be included in members");
      }
      if (newMembers.length < 2) {
        throw new ApiError(400, "Expense must have at least 2 members");
      }
      const shareAmount = (newAmount / newMembers.length).toFixed(2);

      await db.transaction(async (tx) => {
        await Expense._reverseBalances(existing, tx);

        await Expense.deleteMembersByExpenseId(expenseId, tx);
        await Expense.insertMembers(
          newMembers.map((uid: string) => ({
            expenseId,
            userId: uid,
            shareAmount,
          })),
          tx,
        );

        await tx
          .update(expenses)
          .set({
            name: body.name ?? existing.name,
            amount: String(newAmount),
            currency: body.currency ?? existing.currency,
            date: parsedUpdatedDate,
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, expenseId));

        const others = newMembers.filter((id: string) => id !== existing.payerId);
        for (const otherId of others) {
          await Balance.updateBalance(
            existing.payerId,
            otherId,
            parseFloat(shareAmount),
            tx,
          );
        }
      });

      return Expense.findById(expenseId);
    } catch (error) {
      console.error("Expense.updateExpense failed:", error);
      throw asServiceError(error, "Failed to update expense");
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

      await db.transaction(async (tx) => {
        await Expense._reverseBalances(existing, tx);
        await tx.delete(expenses).where(eq(expenses.id, expenseId)); // cascades members
      });
    } catch (error) {
      console.error("Expense.deleteExpense failed:", error);
      throw asServiceError(error, "Failed to delete expense");
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
      throw asServiceError(error, "Failed to fetch activity log");
    }
  };

  // ─── Internal helper ─────────────────────────────────────────────────────────

  static _reverseBalances = async (expense: {
    payerId: string;
    expenseMembers: { userId: string; shareAmount: string }[];
  }, dbExecutor: any = db) => {
    try {
      const others = expense.expenseMembers.filter(
        (m) => m.userId !== expense.payerId,
      );
      for (const m of others) {
        await Balance.updateBalance(
          expense.payerId,
          m.userId,
          -parseFloat(m.shareAmount),
          dbExecutor,
        );
      }
    } catch (error) {
      throw asServiceError(error, "Failed to reverse balances");
    }
  };
}

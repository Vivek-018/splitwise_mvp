import { Request, Response, NextFunction } from "express";
import dbService from "../services/dbService";
import { ApiError } from "../utils/ApiError";

const getUserId = (req: Request): string => {
  const id = req.headers["x-user-id"] as string;
  if (!id) throw new ApiError(400, "x-user-id header required");
  return id;
};

const getErrorDetails = (error: unknown) => {
  if (error instanceof ApiError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof Error) {
    return { statusCode: 500, message: error.message };
  }
  return { statusCode: 500, message: "Unexpected error occurred" };
};

export default class ExpenseController {
  static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const expense = await dbService.Expense.createExpense(userId, req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      console.error("ExpenseController.create failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to create expense: ${message}`,
      });
    }
  };

  static getOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const id = req.params.id as string;
      const expense = await dbService.Expense.getExpense(id, userId);
      res.json({ success: true, data: expense });
    } catch (error) {
      console.error("ExpenseController.getOne failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to fetch expense: ${message}`,
      });
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const expense = await dbService.Expense.updateExpense(
        req.params.id as string,
        userId,
        req.body,
      );
      res.json({ success: true, data: expense });
    } catch (error) {
      console.error("ExpenseController.update failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to update expense: ${message}`,
      });
    }
  };

  static remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      await dbService.Expense.deleteExpense(req.params.id as string, userId);
      res.json({ success: true, message: "Expense deleted" });
    } catch (error) {
      console.error("ExpenseController.remove failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to delete expense: ${message}`,
      });
    }
  };

  static activityLog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = getUserId(req);
      const {
        range = "current",
        from,
        to,
      } = req.query as Record<string, string>;
      const logs = await dbService.Expense.getActivityLog(
        userId,
        range as "current" | "last" | "custom",
        from,
        to,
      );
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error("ExpenseController.activityLog failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to fetch activity log: ${message}`,
      });
    }
  };
}

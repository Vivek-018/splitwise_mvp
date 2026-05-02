import { Request, Response, NextFunction } from "express";
import dbService from "../services/dbService";
import { ApiError } from "../utils/ApiError";

export default class BalanceController {
  static getMyBalances = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) throw new ApiError(400, "x-user-id header required");
      const data = await dbService.Balance.getMyBalances(userId);
      res.json({ success: true, data });
    } catch (error) {
      return res
        .status(500)
        .json({ status: false, message: "Failed to fetch balance" });
    }
  };
}

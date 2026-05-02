import dbService from "../services/dbService";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

export default class UserController {
  static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await dbService.User.createUser(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      return res
        .status(500)
        .json({ status: false, message: `Failed to create user: ${error}`});
    }
  };

  static getMe = async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res
          .status(400)
          .json({ success: false, message: "x-user-id header required" });
      }
      const user = await dbService.User.getUser(userId);
      res.json({ success: true, data: user });
    } catch (error) {
      return res
        .status(500)
        .json({ status: false, message: "Failed to fetch user details" });
    }
  };

  static updateMe = async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res
          .status(400)
          .json({ success: false, message: "x-user-id header required" });
      }

      const { email, currency } = req.body;
      // Nothing to update
      if (!email && !currency) {
        throw new Error(
          "At least one field (email or currency) is required to update",
        );
      }

      const user = await dbService.User.updateUser(userId, {
        email,
        defaultCurrency: currency,
      });

      res.json({ success: true, data: user });
    } catch (error: any) {
      return res
        .status(500)
        .json({ status: false, message: "Failed to update user details" });
    }
  };

  static deleteMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res
          .status(400)
          .json({ success: false, message: "x-user-id header required" });
      }

      await dbService.User.deleteUser(userId);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      return res
        .status(500)
        .json({ status: false, message: "Failed to delete user account" });
    }
  };
}

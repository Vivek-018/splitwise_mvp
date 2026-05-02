import dbService from "../services/dbService";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

const getErrorDetails = (error: unknown) => {
  if (error instanceof ApiError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof Error) {
    return { statusCode: 500, message: error.message };
  }
  return { statusCode: 500, message: "Unexpected error occurred" };
};

export default class UserController {
  static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await dbService.User.createUser(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      console.error("UserController.create failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to create user: ${message}`,
      });
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
      console.error("UserController.getMe failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to fetch user details: ${message}`,
      });
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
    } catch (error) {
      console.error("UserController.updateMe failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to update user details: ${message}`,
      });
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
      console.error("UserController.deleteMe failed:", error);
      const { statusCode, message } = getErrorDetails(error);
      return res.status(statusCode).json({
        success: false,
        message: `Failed to delete user account: ${message}`,
      });
    }
  };
}

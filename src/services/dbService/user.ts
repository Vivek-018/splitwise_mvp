import { and, eq } from "drizzle-orm";
import { NewUser, users } from "../../models/schema";
import { db } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import bcrypt from "bcrypt";
import { CreateUserBody } from "../../interfaces";
import { UserAccountStatus } from "../../enums";

const asServiceError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) return new Error(`${fallbackMessage}: ${error.message}`);
  return new Error(`${fallbackMessage}: ${String(error)}`);
};

export default class User {
  static findByEmail = async (email: string): Promise<User | undefined> => {
    try {
      return await db.query.users.findFirst({ where: eq(users.email, email) });
    } catch (error) {
      throw asServiceError(error, "Failed to fetch user by email");
    }
  };

  static findById = async (id: string) => {
    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.id, id),
          eq(users.accountStatus, UserAccountStatus.ACTIVE),
        ),
      });
      return user;
    } catch (error) {
      throw asServiceError(error, "Failed to fetch user by id");
    }
  };

  static create = async (data: NewUser) => {
    try {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    } catch (error) {
      throw asServiceError(error, "Failed while creating user");
    }
  };

  static createUser = async (body: CreateUserBody) => {
    try {
      const existing = await this.findByEmail(body.email);
      if (existing)
        throw new ApiError(409, "User with this email already exists");
      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await this.create({
        name: body.name,
        email: body.email,
        passwordHash,
        defaultCurrency: body.defaultCurrency ?? "INR",
      });
      const { passwordHash: _, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      throw asServiceError(error, "Failed to create user");
    }
  };

  static getUser = async (userId: string) => {
    try {
      const user = await this.findById(userId);
      if (!user) throw new ApiError(404, "User not found");
      const { passwordHash: _, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      throw asServiceError(error, "Failed to fetch user");
    }
  };

  static updateUser = async (
    userId: string,
    data: Partial<{ email: string; defaultCurrency: string }>,
  ) => {
    try {
      const user = await User.findById(userId);
      if (!user) throw new ApiError(404, "User not found");

      // If updating email, check it's not already taken by someone else
      if (data.email && data.email !== user.email) {
        const existing = await User.findByEmail(data.email);
        if (existing)
          throw new ApiError(409, "Email is already in use by another account");
      }

      const [updated] = await db
        .update(users)
        .set({
          ...(data.email && { email: data.email }),
          ...(data.defaultCurrency && {
            defaultCurrency: data.defaultCurrency,
          }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      const { passwordHash: _, ...safeUser } = updated;
      return safeUser;
    } catch (error) {
      throw asServiceError(error, "Failed to update user");
    }
  };

  static deleteUser = async (userId: string) => {
    try {
      const user = await User.findById(userId);
      if (!user) throw new ApiError(404, "User not found");
      if (user.accountStatus === "deleted")
        throw new ApiError(409, "Account is already deleted");

      await db
        .update(users)
        .set({
          accountStatus: UserAccountStatus.DELETED,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (error) {
      throw asServiceError(error, "Failed to delete user");
    }
  };
}

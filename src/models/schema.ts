import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  unique,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { UserAccountStatus, Currency } from "../enums";

export const accountStatus = pgEnum(
  "account_status",
  Object.values(UserAccountStatus) as [string, ...string[]],
);

export const currencies = pgEnum(
  "currency",
  Object.values(Currency) as [string, ...string[]],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  defaultCurrency: currencies("default_currency")
    .notNull()
    .default(Currency.INR),
  accountStatus: accountStatus("account_status")
    .notNull()
    .default(UserAccountStatus.ACTIVE),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencies("currency").notNull(),
  payerId: uuid("payer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const expenseMembers = pgTable(
  "expense_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shareAmount: numeric("share_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    uniqueMemberPerExpense: unique().on(table.expenseId, table.userId),
  }),
);

export const balances = pgTable(
  "balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always: userId < otherUserId (lexicographic) to avoid duplicate pairs
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    otherUserId: uuid("other_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Positive = userId is owed money by otherUserId
    // Negative = userId owes money to otherUserId
    amount: numeric("amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
  },
  (table) => ({
    uniquePair: unique().on(table.userId, table.otherUserId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseMember = typeof expenseMembers.$inferSelect;
export type Balance = typeof balances.$inferSelect;

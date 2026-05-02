import { Currency } from "../enums";

export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  defaultCurrency?: Currency;
}

export interface CreateExpenseBody {
  name: string;
  amount: number;
  currency: string;
  memberIds: string[];   // userIds of everyone involved (including payer)
  date: string;          // ISO string
}

export interface UpdateExpenseBody {
  name?: string;
  amount?: number;
  currency?: string;
  memberIds?: string[];
  date?: string;
}
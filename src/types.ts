export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface Payment {
  id: string;
  amount: number;
  isPaid: boolean;
  paidAt?: Date;
}

export interface SavingsPlan {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  startDate: Date;
  payments: Payment[];
}

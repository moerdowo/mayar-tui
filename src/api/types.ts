export interface MayarPagination {
  total?: number;
  page?: number;
  pageSize?: number;
  totalPage?: number;
}

export interface MayarEnvelope<T> {
  statusCode?: number;
  messages?: string;
  status?: string;
  data?: T;
  pagination?: MayarPagination;
  hasMore?: boolean;
  nextPage?: number | null;
}

export interface BalanceData {
  balance?: number;
  pendingBalance?: number;
  currency?: string;
  totalBalance?: number;
  active?: number;
  pending?: number;
}

export interface CustomerData {
  id?: string;
  name?: string;
  email?: string;
  mobile?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductData {
  id?: string;
  name?: string;
  type?: string;
  amount?: number;
  status?: string;
  link?: string;
  description?: string;
  createdAt?: string;
}

export interface InvoiceData {
  id?: string;
  transactionId?: string;
  link?: string;
  status?: string;
  customerName?: string;
  customerEmail?: string;
  amount?: number;
  description?: string;
  createdAt?: string;
}

export interface PaymentData {
  id?: string;
  name?: string;
  amount?: number;
  status?: string;
  link?: string;
  description?: string;
  createdAt?: string;
}

export interface TransactionData {
  id?: string;
  status?: string;
  statusCode?: string;
  amount?: number;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  productName?: string;
  productType?: string;
  paymentChannel?: string;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  merchantId?: string;
  merchantName?: string;
}

export type AnyRecord = Record<string, unknown>;

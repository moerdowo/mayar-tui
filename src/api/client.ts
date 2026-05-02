import type {
  AnyRecord,
  BalanceData,
  CustomerData,
  InvoiceData,
  MayarEnvelope,
  PaymentData,
  ProductData,
  TransactionData,
} from "./types.js";

export type MayarEnv = "production" | "sandbox";

export interface MayarClientOptions {
  apiKey: string;
  env?: MayarEnv;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 20;

const PROD_BASE = "https://api.mayar.id/hl/v1";
const SANDBOX_BASE = "https://api.mayar.club/hl/v1";

// Mayar endpoints aren't perfectly consistent — most accept `pageSize`
// (camelCase), but the product endpoint historically expects `page_size`
// (snake_case). Send both so the request honors our intent regardless.
function paging(q: PageQuery): Record<string, string | number | undefined> {
  return {
    page: q.page ?? 1,
    pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
    page_size: q.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

export class MayarApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MayarApiError";
    this.status = status;
    this.body = body;
  }
}

export class MayarClient {
  readonly baseUrl: string;
  readonly env: MayarEnv;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: MayarClientOptions) {
    if (!opts.apiKey) throw new Error("MayarClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.env = opts.env ?? "production";
    this.baseUrl =
      opts.baseUrl ?? (this.env === "sandbox" ? SANDBOX_BASE : PROD_BASE);
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    init?: { query?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<MayarEnvelope<T>> {
    const url = new URL(this.baseUrl + path);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "mayartui/0.1.0",
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const reason = (err as Error).name === "AbortError" ? "Request timeout" : (err as Error).message;
      throw new MayarApiError(reason, 0, null);
    }
    clearTimeout(timer);

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === "object" && "messages" in parsed
          ? String((parsed as AnyRecord).messages)
          : null) ?? `HTTP ${res.status}`;
      throw new MayarApiError(msg, res.status, parsed);
    }

    return (parsed ?? {}) as MayarEnvelope<T>;
  }

  balance() {
    return this.request<BalanceData>("GET", "/balance");
  }

  paidTransactions(q: PageQuery = {}) {
    return this.request<TransactionData[]>("GET", "/transactions", {
      query: paging(q),
    });
  }

  unpaidTransactions(q: PageQuery = {}) {
    return this.request<TransactionData[]>("GET", "/transactions/unpaid", {
      query: paging(q),
    });
  }

  products(q: PageQuery & { type?: string; search?: string } = {}) {
    const path = q.type ? `/product/type/${encodeURIComponent(q.type)}` : "/product";
    return this.request<ProductData[]>("GET", path, {
      query: { ...paging(q), search: q.search },
    });
  }

  customers(q: PageQuery = {}) {
    return this.request<CustomerData[]>("GET", "/customer", {
      query: paging(q),
    });
  }

  invoices(q: PageQuery & { sort?: string } = {}) {
    return this.request<InvoiceData[]>("GET", "/invoice", {
      query: { ...paging(q), sort: q.sort },
    });
  }

  singlePayments(q: PageQuery & { sort?: string } = {}) {
    return this.request<PaymentData[]>("GET", "/payment", {
      query: { ...paging(q), sort: q.sort },
    });
  }
}

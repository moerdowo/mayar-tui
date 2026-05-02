// Verify every paginated client method sends both pageSize=20 and page_size=20
// by intercepting the URL via a fake fetch.
import { MayarClient } from "../src/api/client.js";

const seen: string[] = [];
const fakeFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  seen.push(url);
  return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const c = new MayarClient({
  apiKey: "test",
  env: "production",
  fetch: fakeFetch,
});

await Promise.all([
  c.paidTransactions(),
  c.unpaidTransactions(),
  c.invoices(),
  c.singlePayments(),
  c.products(),
  c.customers(),
]);

let failures = 0;
for (const url of seen) {
  const u = new URL(url);
  const ps = u.searchParams.get("pageSize");
  const sn = u.searchParams.get("page_size");
  const ok = ps === "20" && sn === "20";
  process.stdout.write(`${ok ? "✓" : "✗"} ${u.pathname}  pageSize=${ps}  page_size=${sn}\n`);
  if (!ok) failures++;
}

if (failures > 0) {
  process.stderr.write(`\nFAIL: ${failures} call(s) missing pageSize/page_size=20\n`);
  process.exit(1);
}
process.stdout.write("\nOK · all paginated calls send pageSize=20 and page_size=20\n");

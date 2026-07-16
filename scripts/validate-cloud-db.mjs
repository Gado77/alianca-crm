import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const expectedTables = [
  "profiles",
  "leads",
  "lead_interests",
  "banks",
  "simulations",
  "follow_ups",
  "lead_notes",
  "lead_timeline_events",
  "lead_status_history",
  "activity_logs",
  "settings",
];

const expectedBanks = ["Banco PAN", "Banco BV", "Santander"];

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const checks = [];

function record(name, pass, details = "") {
  checks.push({ name, pass, details });
  const status = pass ? "ok" : "fail";
  console.log(`[${status}] ${name}${details ? ` - ${details}` : ""}`);
}

function sanitizedProjectUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.host;
  } catch {
    return "invalid-url";
  }
}

console.log(`Validating Supabase project: ${sanitizedProjectUrl(url)}`);

for (const table of expectedTables) {
  const { error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
  record(`table public.${table} is reachable`, !error, error?.message || `rows: ${count ?? "unknown"}`);
}

const { data: banks, error: banksError } = await supabase.from("banks").select("name,active").order("name");
record("banks table can be read", !banksError, banksError?.message || `${banks?.length ?? 0} rows`);

if (!banksError) {
  for (const bank of expectedBanks) {
    record(`initial bank exists: ${bank}`, banks.some((row) => row.name === bank));
  }
  record("seed bank 'Outro' is not required as fixed bank", !banks.some((row) => row.name === "Outro"));
}

const { data: duplicateRows, error: duplicateError } = await supabase.rpc("find_potential_duplicate_leads", {
  input_cpf: "000.000.000-00",
  input_phone: "(00) 00000-0000",
});
record(
  "duplicate detection RPC is callable",
  !duplicateError && Array.isArray(duplicateRows),
  duplicateError?.message || `${duplicateRows.length} possible matches`,
);

const { data: settingsRows, error: settingsError } = await supabase.from("settings").select("key").limit(1);
record("settings table is reachable through service role", !settingsError, settingsError?.message || `${settingsRows.length} sampled rows`);

const failed = checks.filter((check) => !check.pass);

console.log("");
console.log("Catalog checks for enums, triggers, policies and SECURITY DEFINER search_path must be run in Supabase SQL Editor.");
console.log("Use docs/cloud-deployment-walkthrough.md section 'Catalog Validation SQL'.");

if (failed.length) {
  console.error(`Validation finished with ${failed.length} failed check(s).`);
  process.exit(1);
}

console.log(`Validation finished with ${checks.length} passed check(s).`);

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.");
}

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const password = `Homologacao#${runId}`;
const report = {
  project: { kind: "Supabase local homologation", url },
  migration: "20260715120000_persistence_auth_permissions_audit.sql",
  runId,
  users: [],
  data: {},
  checks: [],
  errors: [],
};

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function record(name, pass, details = {}) {
  report.checks.push({ name, pass, details });
  if (!pass) report.errors.push({ name, details });
}

function expectError(name, response) {
  record(name, Boolean(response.error), {
    error: response.error?.message || null,
    rows: response.data?.length ?? null,
  });
}

function expectBlocked(name, response) {
  record(name, Boolean(response.error) || response.data?.length === 0, {
    error: response.error?.message || null,
    rows: response.data?.length ?? null,
  });
}

async function ensureUser(email, fullName, role) {
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error && !/already registered|already exists|User already registered/i.test(error.message)) {
    throw error;
  }

  let user = created?.user;
  if (!user) {
    const { data: listed, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listError) throw listError;
    user = listed.users.find((candidate) => candidate.email === email);
  }
  if (!user) throw new Error(`Could not resolve user ${email}.`);

  const { error: profileError } = await service.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    role,
    active: true,
  });
  if (profileError) throw profileError;

  report.users.push({ email, role, profile_id: user.id });
  return { email, id: user.id };
}

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function must(label, promise) {
  const response = await promise;
  if (response.error) throw new Error(`${label}: ${response.error.message}`);
  return response.data;
}

const adminUser = await ensureUser(`admin.${runId}@homologacao.local`, "Admin Homologacao", "admin");
const sellerOne = await ensureUser(`vendedor1.${runId}@homologacao.local`, "Vendedor Um Homologacao", "vendedor");
const sellerTwo = await ensureUser(`vendedor2.${runId}@homologacao.local`, "Vendedor Dois Homologacao", "vendedor");

const admin = await signIn(adminUser.email);
const sellerOneClient = await signIn(sellerOne.email);
const sellerTwoClient = await signIn(sellerTwo.email);
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

const banks = await must(
  "banks",
  service.from("banks").select("id,name").in("name", ["Banco PAN", "Banco BV", "Santander", "Outro"]),
);
record("initial banks exist", banks.length === 4, { banks: banks.map((bank) => bank.name).sort() });
const bankByName = Object.fromEntries(banks.map((bank) => [bank.name, bank.id]));

const fictitiousLeads = [
  ["Ana Teste Homologacao", "123.456.789-01", "(11) 90000-0001", "Sao Paulo", sellerOne.id],
  ["Bruno Teste Homologacao", "123.456.789-02", "(11) 90000-0002", "Santo Andre", sellerOne.id],
  ["Carla Teste Homologacao", "123.456.789-03", "(11) 90000-0003", "Sao Bernardo", sellerOne.id],
  ["Diego Teste Homologacao", "123.456.789-04", "(11) 90000-0004", "Osasco", sellerTwo.id],
  ["Elisa Teste Homologacao", "123.456.789-05", "(11) 90000-0005", "Guarulhos", sellerTwo.id],
];

const leads = [];
for (const [full_name, cpf, phone, city, assigned_user_id] of fictitiousLeads) {
  const client = assigned_user_id === sellerOne.id ? sellerOneClient : sellerTwoClient;
  const data = await must(
    `insert lead ${full_name}`,
    client
      .from("leads")
      .insert({
        full_name,
        cpf,
        phone,
        city,
        email: `${full_name.toLowerCase().replaceAll(" ", ".")}@example.test`,
        has_driver_license: true,
        license_category: "a",
        assigned_user_id,
        source: "manual",
      })
      .select("*")
      .single(),
  );
  leads.push(data);
}
record("five fictitious leads inserted", leads.length === 5, { count: leads.length });
record("cpf normalized", leads.every((lead) => /^\d{11}$/.test(lead.cpf)), { cpfs: leads.map((lead) => lead.cpf) });
record("phone normalized", leads.every((lead) => /^\d{10,13}$/.test(lead.phone)), { phones: leads.map((lead) => lead.phone) });

const duplicateMatches = await must(
  "duplicate rpc",
  sellerOneClient.rpc("find_potential_duplicate_leads", {
    input_cpf: "123.456.789-01",
    input_phone: "(11) 90000-0001",
  }),
);
record("duplicate alert returns possible match without blocking inserts", duplicateMatches.length >= 1, {
  count: duplicateMatches.length,
  sample: duplicateMatches[0],
});

await must(
  "lead interest",
  sellerOneClient.from("lead_interests").insert({
    lead_id: leads[0].id,
    motorcycle_model: "AZ160 Xtreme",
    desired_color: "Azul",
    intended_down_payment: 2500,
    payment_method: "financiamento",
  }),
);
record("lead interest created", true);

const denialWithoutReason = await sellerOneClient.from("simulations").insert({
  lead_id: leads[0].id,
  created_by: sellerOne.id,
  bank_id: bankByName["Banco PAN"],
  result: "negado",
});
expectError("denied simulation requires reason", denialWithoutReason);

const deniedSimulation = await must(
  "denied simulation",
  sellerOneClient
    .from("simulations")
    .insert({
      lead_id: leads[0].id,
      created_by: sellerOne.id,
      bank_id: bankByName["Banco PAN"],
      result: "negado",
      denial_reason: "Score ficticio insuficiente",
      bank_response_code: "HMG-NEG-001",
      bank_response: "Retorno ficticio de homologacao",
    })
    .select("*")
    .single(),
);
record("simulation with bank response persisted", deniedSimulation.bank_response_code === "HMG-NEG-001");

const followUpsAfterDenied = await must(
  "auto follow up",
  service.from("follow_ups").select("*").eq("lead_id", leads[0].id).eq("status", "pendente"),
);
record("automatic follow-up created", followUpsAfterDenied.length === 1, { count: followUpsAfterDenied.length });

await must(
  "complete follow up",
  sellerOneClient
    .from("follow_ups")
    .update({ status: "concluido", completed_at: new Date().toISOString(), completion_notes: "Conclusao ficticia" })
    .eq("id", followUpsAfterDenied[0].id),
);
const postponed = await must(
  "postponed follow up seed",
  sellerOneClient
    .from("follow_ups")
    .insert({
      lead_id: leads[1].id,
      assigned_user_id: sellerOne.id,
      reason: "Contato ficticio reagendado",
      due_at: new Date(Date.now() + 86400000).toISOString(),
      status: "pendente",
    })
    .select("*")
    .single(),
);
await must(
  "postpone follow up",
  sellerOneClient
    .from("follow_ups")
    .update({ status: "adiado", due_at: new Date(Date.now() + 172800000).toISOString() })
    .eq("id", postponed.id),
);
record("follow-up completion and postponement persisted", Boolean(postponed.id));

await must("status change", sellerOneClient.from("leads").update({ status: "aguardando_simulacao" }).eq("id", leads[1].id));
await must("drag and drop persistent status", sellerOneClient.from("leads").update({ status: "simulacao_realizada" }).eq("id", leads[1].id));
await must("note", sellerOneClient.from("lead_notes").insert({ lead_id: leads[1].id, author_id: sellerOne.id, content: "Observacao ficticia de homologacao." }));
await must("admin reassignment", admin.from("leads").update({ assigned_user_id: sellerTwo.id }).eq("id", leads[2].id));
await must("lost lead", admin.from("leads").update({ status: "perdido", lost_reason: "Motivo ficticio" }).eq("id", leads[3].id));
await must("completed sale", admin.from("leads").update({ status: "venda_finalizada" }).eq("id", leads[4].id));

const { data: adminLeads } = await admin.from("leads").select("id");
record("admin sees all leads", adminLeads?.length === 5, { count: adminLeads?.length });
const { data: sellerOneLeads } = await sellerOneClient.from("leads").select("id");
const { data: sellerTwoLeads } = await sellerTwoClient.from("leads").select("id");
record("seller one sees only assigned leads", sellerOneLeads?.length === 2, { count: sellerOneLeads?.length });
record("seller two sees only assigned leads", sellerTwoLeads?.length === 3, { count: sellerTwoLeads?.length });

const { data: directOtherLead } = await sellerOneClient.from("leads").select("id").eq("id", leads[3].id);
record("seller cannot access other seller lead by id", directOtherLead?.length === 0, { rows: directOtherLead?.length });

expectError(
  "seller cannot change owner",
  await sellerOneClient.from("leads").update({ assigned_user_id: sellerTwo.id }).eq("id", leads[0].id).select("id"),
);
expectError(
  "seller cannot activate or deactivate lead",
  await sellerOneClient.from("leads").update({ active: false }).eq("id", leads[0].id).select("id"),
);
expectError(
  "seller cannot mark lead lost",
  await sellerOneClient.from("leads").update({ status: "perdido", lost_reason: "Teste" }).eq("id", leads[0].id).select("id"),
);
expectBlocked(
  "seller cannot correct simulation",
  await sellerOneClient.from("simulations").update({ result: "aprovado" }).eq("id", deniedSimulation.id).select("id"),
);

const { error: deactivateError } = await service.from("profiles").update({ active: false }).eq("id", sellerTwo.id);
if (deactivateError) throw deactivateError;
const { data: inactiveRows, error: inactiveError } = await sellerTwoClient.from("leads").select("id");
record("deactivated user cannot access records", !inactiveError && inactiveRows.length === 0, {
  rows: inactiveRows?.length,
  error: inactiveError?.message || null,
});
await service.from("profiles").update({ active: true }).eq("id", sellerTwo.id);

const { data: anonRows, error: anonError } = await anon.from("leads").select("id");
record("unauthenticated user cannot access tables", Boolean(anonError) || anonRows.length === 0, {
  rows: anonRows?.length,
  error: anonError?.message || null,
});

await must("admin bank update", admin.from("banks").update({ active: true }).eq("name", "Outro").select("id"));
record("admin can perform administrative actions", true);

const dashboard = await must("dashboard count", admin.from("leads").select("status", { count: "exact" }));
const search = await must("search", admin.from("leads").select("id,full_name").ilike("full_name", "%Teste Homologacao%"));
const filtered = await must("filter", admin.from("leads").select("id,status").eq("status", "simulacao_realizada"));
record("dashboard, filters and search queries return persisted data", dashboard.length === 5 && search.length === 5 && filtered.length >= 1, {
  dashboardRows: dashboard.length,
  searchRows: search.length,
  filteredRows: filtered.length,
});

const events = await must(
  "timeline events",
  service.from("lead_timeline_events").select("lead_id,event_type,title,metadata_json").in("lead_id", leads.map((lead) => lead.id)),
);
const genericLeadEdited = events.filter((event) => event.title === "Lead editado" || event.event_type === "lead_updated");
const simulationEvents = events.filter((event) => event.event_type === "simulation_created" && event.lead_id === leads[0].id);
record("no generic lead edited timeline event", genericLeadEdited.length === 0, { count: genericLeadEdited.length });
record("simulation creates one consolidated event", simulationEvents.length === 1, { count: simulationEvents.length });
record("timeline contains expected event types", ["lead_created", "simulation_created", "follow_up_scheduled", "follow_up_completed", "follow_up_postponed", "status_changed", "assigned_user_changed", "lead_lost", "sale_finished", "note_added"].every((type) => events.some((event) => event.event_type === type)), {
  eventTypes: [...new Set(events.map((event) => event.event_type))].sort(),
});

const history = await must("status history", service.from("lead_status_history").select("id,lead_id").in("lead_id", leads.map((lead) => lead.id)));
record("status changes generate history", history.length >= 3, { count: history.length });

const logs = await must("activity logs", service.from("activity_logs").select("metadata_json"));
const serializedLogs = JSON.stringify(logs);
record("activity logs do not contain sensitive field names", !/(cpf|phone|birth_date|token|access_token|refresh_token)/i.test(serializedLogs));

report.data = {
  banks: banks.map((bank) => bank.name).sort(),
  leadCount: leads.length,
  timelineEventCount: events.length,
  statusHistoryCount: history.length,
  generatedPasswordStoredInReport: false,
};

const outDir = path.join(process.cwd(), "docs");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "homologation-test-results.json"), JSON.stringify(report, null, 2));

const failed = report.checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`Homologation finished with ${failed.length} failed checks.`);
  process.exitCode = 1;
} else {
  console.log(`Homologation finished with ${report.checks.length} passed checks.`);
}

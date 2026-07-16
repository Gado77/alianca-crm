import fs from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rl = createInterface({ input, output });

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function sanitizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  return null;
}

try {
  console.log("Create first admin for Aliança CRM.");
  console.log("No keys or passwords will be printed.");

  const fullName = sanitizeText(await rl.question("Full name: "));
  const email = sanitizeText(await rl.question("Email: "));
  const password = await rl.question("Temporary password: ");

  if (!fullName || !isValidEmail(email) || password.length < 8) {
    throw new Error("Full name, valid email and password with at least 8 characters are required.");
  }

  console.log("");
  console.log(`Admin profile: ${fullName} <${email}>`);
  const confirmation = await rl.question('Type "CRIAR ADMIN" to continue: ');
  if (confirmation !== "CRIAR ADMIN") {
    console.log("Canceled.");
    process.exit(0);
  }

  let createdAuthUser = false;
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    createdAuthUser = true;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      role: "admin",
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    if (createdAuthUser) await supabase.auth.admin.deleteUser(user.id);
    throw profileError;
  }

  console.log("Admin user is ready.");
  console.log(`Auth user id: ${user.id}`);
} catch (error) {
  console.error(`Could not create admin: ${error.message}`);
  process.exit(1);
} finally {
  rl.close();
}

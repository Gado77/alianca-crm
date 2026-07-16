import { createSupabaseServerClient, getCurrentSessionProfile } from "@/lib/supabase/server";

export type ProfileRow = {
  id: string;
  full_name: string;
  role: "admin" | "vendedor";
  phone: string | null;
  active: boolean;
};

export async function getAppContext() {
  const context = await getCurrentSessionProfile();
  if (!context.user || !context.profile) return context;
  return context as typeof context & { profile: ProfileRow };
}

export async function getProfiles() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,role,phone,active")
    .order("full_name");
  return (data || []) as ProfileRow[];
}

export async function getBanks(includeInactive = false) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("banks").select("*").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data || [];
}

export async function getLeadCollections() {
  const supabase = await createSupabaseServerClient();
  const [
    leadsResult,
    interestsResult,
    profilesResult,
    simulationsResult,
    followUpsResult,
    notesResult,
    timelineResult,
    banksResult,
  ] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("lead_interests").select("*"),
    supabase.from("profiles").select("id,full_name,role,phone,active"),
    supabase.from("simulations").select("*").order("created_at", { ascending: false }),
    supabase.from("follow_ups").select("*").order("due_at", { ascending: true }),
    supabase.from("lead_notes").select("*").order("created_at", { ascending: false }),
    supabase.from("lead_timeline_events").select("*").order("created_at", { ascending: false }),
    supabase.from("banks").select("*").order("name"),
  ]);

  return {
    leads: leadsResult.data || [],
    interests: interestsResult.data || [],
    profiles: (profilesResult.data || []) as ProfileRow[],
    simulations: simulationsResult.data || [],
    followUps: followUpsResult.data || [],
    notes: notesResult.data || [],
    timeline: timelineResult.data || [],
    banks: banksResult.data || [],
    errors: [
      leadsResult.error,
      interestsResult.error,
      profilesResult.error,
      simulationsResult.error,
      followUpsResult.error,
      notesResult.error,
      timelineResult.error,
      banksResult.error,
    ].filter(Boolean),
  };
}

export async function getLeadById(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error || !lead) {
    return {
      lead: null,
      interest: null,
      simulations: [],
      followUps: [],
      notes: [],
      timeline: [],
      profiles: [] as ProfileRow[],
      banks: [],
      error,
    };
  }

  const [interests, simulations, followUps, notes, timeline, profiles, banks] = await Promise.all([
    supabase.from("lead_interests").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("simulations").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("follow_ups").select("*").eq("lead_id", id).order("due_at", { ascending: true }),
    supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("lead_timeline_events").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,role,phone,active"),
    supabase.from("banks").select("*").order("name"),
  ]);

  return {
    lead,
    interest: interests.data?.[0] || null,
    simulations: simulations.data || [],
    followUps: followUps.data || [],
    notes: notes.data || [],
    timeline: timeline.data || [],
    profiles: (profiles.data || []) as ProfileRow[],
    banks: banks.data || [],
    error: null,
  };
}

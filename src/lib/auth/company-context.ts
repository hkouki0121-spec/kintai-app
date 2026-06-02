import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyRole = "super_admin" | "company_admin";

export type CompanyContext = {
  userId: string;
  email: string | undefined;
  role: CompanyRole;
  companyId: string | null;
  companyName: string | null;
  isSuperAdmin: boolean;
};

type MemberRow = {
  role: CompanyRole;
  company_id: string | null;
  companies: { name: string } | { name: string }[] | null;
};

function resolveCompanyName(
  companies: MemberRow["companies"]
): string | null {
  if (!companies) return null;
  if (Array.isArray(companies)) return companies[0]?.name ?? null;
  return companies.name;
}

export async function getCompanyContext(
  supabase: SupabaseClient
): Promise<CompanyContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member, error } = await supabase
    .from("company_members")
    .select("role, company_id, companies(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member) return null;

  const role = member.role as CompanyRole;

  return {
    userId: user.id,
    email: user.email,
    role,
    companyId: member.company_id,
    companyName: resolveCompanyName(member.companies as MemberRow["companies"]),
    isSuperAdmin: role === "super_admin",
  };
}

export async function requireCompanyContext(
  supabase: SupabaseClient
): Promise<CompanyContext> {
  const context = await getCompanyContext(supabase);
  if (!context) {
    throw new Error("UNAUTHORIZED_COMPANY");
  }
  return context;
}

export function getEffectiveCompanyId(context: CompanyContext): string | null {
  return context.isSuperAdmin ? null : context.companyId;
}

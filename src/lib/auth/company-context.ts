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

export async function getCompanyContext(
  supabase: SupabaseClient
): Promise<CompanyContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select("role, company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !member) {
    if (memberError) {
      console.error("[company-context] company_members read failed", memberError);
    }
    return null;
  }

  const role = member.role as CompanyRole;
  let companyName: string | null = null;

  if (member.company_id) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", member.company_id)
      .maybeSingle();

    if (companyError) {
      console.error("[company-context] companies read failed", companyError);
    } else {
      companyName = company?.name ?? null;
    }
  }

  return {
    userId: user.id,
    email: user.email,
    role,
    companyId: member.company_id,
    companyName,
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

export type CompanyRole = "super_admin" | "company_admin";

export type CompanyContext = {
  userId: string;
  email: string | undefined;
  role: CompanyRole;
  companyId: string | null;
  companyName: string | null;
  isSuperAdmin: boolean;
};

function isCompanyRole(value: string): value is CompanyRole {
  return value === "super_admin" || value === "company_admin";
}

/** 認証済みユーザーの company_members を service role で取得（user.id に限定） */
async function fetchCompanyMember(userId: string) {
  const service = createServiceClient();
  return service
    .from("company_members")
    .select("role, company_id")
    .eq("user_id", userId)
    .maybeSingle();
}

/** 会社名を service role で取得（member.company_id に限定） */
async function fetchCompanyName(companyId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[company-context] companies read failed", error);
    return null;
  }

  return data?.name ?? null;
}

export async function getCompanyContext(
  supabase: SupabaseClient
): Promise<CompanyContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: member, error: memberError } = await fetchCompanyMember(user.id);

  if (memberError) {
    console.error("[company-context] company_members read failed", {
      userId: user.id,
      email: user.email,
      error: memberError,
    });
    return null;
  }

  if (!member) {
    console.error("[company-context] no company_members row", {
      userId: user.id,
      email: user.email,
    });
    return null;
  }

  if (!isCompanyRole(member.role)) {
    console.error("[company-context] invalid role", {
      userId: user.id,
      role: member.role,
    });
    return null;
  }

  const role = member.role;
  let companyName: string | null = null;

  if (member.company_id) {
    companyName = await fetchCompanyName(member.company_id);
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

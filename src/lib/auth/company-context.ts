import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

export type CompanyContextDiagnostics = {
  resolvedUserId: string | null;
  resolvedEmail: string | null;
  getUser: { id: string; email: string | undefined } | null;
  getUserError: string | null;
  getSession: { id: string; email: string | undefined } | null;
  getSessionError: string | null;
  serviceKeyConfigured: boolean;
  supabaseUrlHost: string | null;
  member: { role: string; company_id: string | null } | null;
  memberError: {
    message: string;
    code: string | null;
    details: string | null;
  } | null;
  companyName: string | null;
  companyError: {
    message: string;
    code: string | null;
    details: string | null;
  } | null;
  roleValid: boolean;
  failureReason: string | null;
  context: CompanyContext | null;
  authCookieNames: string[];
};

function isCompanyRole(value: string): value is CompanyRole {
  return value === "super_admin" || value === "company_admin";
}

function serializeError(error: AuthError | { message: string; code?: string; details?: string } | null) {
  if (!error) return null;
  return {
    message: error.message,
    code: "code" in error && error.code ? String(error.code) : null,
    details: "details" in error && error.details ? String(error.details) : null,
  };
}

function pickUser(user: User | null | undefined) {
  if (!user) return null;
  return { id: user.id, email: user.email };
}

function logDiagnostics(label: string, diagnostics: CompanyContextDiagnostics) {
  console.log(`[company-context] ${label}`, JSON.stringify(diagnostics, null, 2));
}

async function resolveAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user: authUser },
    error: getUserError,
  } = await supabase.auth.getUser();

  const {
    data: { session },
    error: getSessionError,
  } = await supabase.auth.getSession();

  const user = authUser ?? session?.user ?? null;

  return {
    user,
    getUser: pickUser(authUser),
    getUserError: getUserError?.message ?? null,
    getSession: pickUser(session?.user),
    getSessionError: getSessionError?.message ?? null,
  };
}

async function fetchCompanyMemberWithService(userId: string) {
  const serviceKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const supabaseUrlHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : null;

  if (!serviceKeyConfigured) {
    return {
      serviceKeyConfigured,
      supabaseUrlHost,
      member: null,
      memberError: {
        message: "SUPABASE_SERVICE_ROLE_KEY が未設定です",
        code: "CONFIG",
        details: null,
      },
    };
  }

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("company_members")
      .select("role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      serviceKeyConfigured,
      supabaseUrlHost,
      member: data,
      memberError: serializeError(error),
    };
  } catch (error) {
    return {
      serviceKeyConfigured,
      supabaseUrlHost,
      member: null,
      memberError: {
        message: error instanceof Error ? error.message : String(error),
        code: "SERVICE_CLIENT",
        details: null,
      },
    };
  }
}

async function fetchCompanyNameWithService(companyId: string) {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    return {
      companyName: data?.name ?? null,
      companyError: serializeError(error),
    };
  } catch (error) {
    return {
      companyName: null,
      companyError: {
        message: error instanceof Error ? error.message : String(error),
        code: "SERVICE_CLIENT",
        details: null,
      },
    };
  }
}

export async function getCompanyContextDiagnostics(
  supabase: SupabaseClient
): Promise<CompanyContextDiagnostics> {
  const cookieStore = await cookies();
  const authCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter(
      (name) =>
        name.includes("supabase") ||
        name.startsWith("sb-") ||
        name.includes("auth-token")
    );

  const auth = await resolveAuthenticatedUser(supabase);

  const base: CompanyContextDiagnostics = {
    resolvedUserId: auth.user?.id ?? null,
    resolvedEmail: auth.user?.email ?? null,
    getUser: auth.getUser,
    getUserError: auth.getUserError,
    getSession: auth.getSession,
    getSessionError: auth.getSessionError,
    serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    supabaseUrlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null,
    member: null,
    memberError: null,
    companyName: null,
    companyError: null,
    roleValid: false,
    failureReason: null,
    context: null,
    authCookieNames,
  };

  if (!auth.user) {
    base.failureReason =
      authCookieNames.length === 0
        ? "authenticated user is null and no auth cookies found on server"
        : "authenticated user is null (getUser and getSession both empty)";
    logDiagnostics("failure", base);
    return base;
  }

  const memberResult = await fetchCompanyMemberWithService(auth.user.id);
  base.serviceKeyConfigured = memberResult.serviceKeyConfigured;
  base.supabaseUrlHost = memberResult.supabaseUrlHost;
  base.member = memberResult.member;
  base.memberError = memberResult.memberError;

  if (memberResult.memberError) {
    base.failureReason = "company_members query error";
    logDiagnostics("failure", base);
    return base;
  }

  if (!memberResult.member) {
    base.failureReason = "company_members row not found for resolved user id";
    logDiagnostics("failure", base);
    return base;
  }

  base.roleValid = isCompanyRole(memberResult.member.role);
  if (!base.roleValid) {
    base.failureReason = `invalid role: ${memberResult.member.role}`;
    logDiagnostics("failure", base);
    return base;
  }

  const role = memberResult.member.role;
  let companyName: string | null = null;

  if (memberResult.member.company_id) {
    const companyResult = await fetchCompanyNameWithService(
      memberResult.member.company_id
    );
    base.companyName = companyResult.companyName;
    base.companyError = companyResult.companyError;
    companyName = companyResult.companyName;
  }

  base.context = {
    userId: auth.user.id,
    email: auth.user.email,
    role,
    companyId: memberResult.member.company_id,
    companyName,
    isSuperAdmin: role === "super_admin",
  };
  base.failureReason = null;

  logDiagnostics("success", base);
  return base;
}

export async function getCompanyContext(
  supabase: SupabaseClient
): Promise<CompanyContext | null> {
  const diagnostics = await getCompanyContextDiagnostics(supabase);
  return diagnostics.context;
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

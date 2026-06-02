import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type MemberRow = {
  user_id: string;
  role: string;
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

/** 会社アカウントのログインメール一覧（管理者向け） */
export async function GET() {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let memberQuery = supabase
    .from("company_members")
    .select("user_id, role, company_id, companies(name)")
    .order("created_at", { ascending: true });

  if (!context.isSuperAdmin && context.companyId) {
    memberQuery = memberQuery.eq("company_id", context.companyId);
  }

  const { data: members, error } = await memberQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const service = createServiceClient();
  const rows = await Promise.all(
    ((members as MemberRow[]) ?? []).map(async (member) => {
      const { data: userData, error: userError } =
        await service.auth.admin.getUserById(member.user_id);

      if (userError || !userData.user) {
        return {
          userId: member.user_id,
          email: null,
          name: null,
          role: member.role,
          companyId: member.company_id,
          companyName: resolveCompanyName(member.companies),
        };
      }

      const meta = userData.user.user_metadata ?? {};
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;

      return {
        userId: member.user_id,
        email: userData.user.email ?? null,
        name,
        role: member.role,
        companyId: member.company_id,
        companyName: resolveCompanyName(member.companies),
      };
    })
  );

  return NextResponse.json({
    currentUserEmail: context.email ?? null,
    accounts: rows,
  });
}

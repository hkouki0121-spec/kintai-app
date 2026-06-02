import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type CreateCompanyRequest = {
  name: string;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
};

function isValidRequest(body: unknown): body is CreateCompanyRequest {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as CreateCompanyRequest).name === "string" &&
    (body as CreateCompanyRequest).name.trim().length > 0
  );
}

/** スーパー管理者: 会社一覧 */
export async function GET() {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ companies: data ?? [] });
}

/** スーパー管理者: 会社作成（任意で管理者アカウントも作成） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ error: "会社名が必要です" }, { status: 400 });
  }

  const service = createServiceClient();
  const companyName = body.name.trim();

  const { data: company, error: companyError } = await service
    .from("companies")
    .insert({ name: companyName })
    .select("id, name")
    .single();

  if (companyError || !company) {
    return NextResponse.json(
      { error: companyError?.message ?? "会社作成に失敗しました" },
      { status: 500 }
    );
  }

  let adminCreated = false;
  if (body.adminEmail && body.adminPassword) {
    const email = body.adminEmail.trim().toLowerCase();
    const adminName = body.adminName?.trim() || companyName;

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password: body.adminPassword,
      email_confirm: true,
      user_metadata: { name: adminName, full_name: adminName },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: authError?.message ?? "管理者アカウント作成に失敗しました",
          company,
        },
        { status: 400 }
      );
    }

    const { error: memberError } = await service.from("company_members").insert({
      user_id: authData.user.id,
      company_id: company.id,
      role: "company_admin",
    });

    if (memberError) {
      await service.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    adminCreated = true;
  }

  return NextResponse.json({ ok: true, company, adminCreated });
}

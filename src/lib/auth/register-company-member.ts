import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type CompanyMemberRow = {
  id: string;
  user_id: string;
  company_id: string;
  role: "company_admin";
};

/** 会社管理者を company_members に登録し、service role で存在確認する */
export async function insertCompanyMember(
  supabase: SupabaseClient,
  params: { userId: string; companyId: string }
): Promise<{ member: CompanyMemberRow | null; error: PostgrestError | null }> {
  const { data: member, error: insertError } = await supabase
    .from("company_members")
    .insert({
      user_id: params.userId,
      company_id: params.companyId,
      role: "company_admin",
    })
    .select("id, user_id, company_id, role")
    .single();

  if (insertError || !member) {
    console.error("[register-company] member insert failed", insertError);
    return { member: null, error: insertError };
  }

  const { data: verified, error: verifyError } = await supabase
    .from("company_members")
    .select("id, user_id, company_id, role")
    .eq("id", member.id)
    .single();

  if (verifyError || !verified) {
    console.error("[register-company] member verify failed", verifyError);
    return { member: null, error: verifyError };
  }

  console.log("[register-company] member ok", verified);
  return { member: verified as CompanyMemberRow, error: null };
}

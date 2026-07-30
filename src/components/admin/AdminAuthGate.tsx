"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompanyContextQuery } from "@/lib/queries/hooks";
import { AdminCompanyProvider } from "@/components/admin/AdminCompanyProvider";

type Props = {
  children: React.ReactNode;
};

/** 認証は初回のみ取得。ページ遷移では再実行しない。 */
export function AdminAuthGate({ children }: Props) {
  const router = useRouter();
  const { data: context, isLoading, isError } = useCompanyContextQuery();

  useEffect(() => {
    if (!isLoading && (isError || !context)) {
      router.replace("/admin/no-access");
    }
  }, [isLoading, isError, context, router]);

  if (!context) {
    return null;
  }

  return <AdminCompanyProvider context={context}>{children}</AdminCompanyProvider>;
}

"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adminQueryDefaults } from "@/lib/queries/defaults";

type Props = {
  children: ReactNode;
};

export function AdminQueryProvider({ children }: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: adminQueryDefaults,
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

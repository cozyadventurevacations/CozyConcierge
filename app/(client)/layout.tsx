import { AppHeader } from "@/components/layout/app-header";
import { clientNav } from "@/components/layout/client-nav";
import { requireClient } from "@/lib/auth/require-client";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireClient();

  return (
    <>
      <AppHeader navItems={clientNav} />
      {children}
    </>
  );
}
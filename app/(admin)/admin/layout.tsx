import { AppHeader } from "@/components/layout/app-header";
import { adminNav } from "@/components/layout/admin-nav";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <AppHeader navItems={adminNav} />
      {children}
    </>
  );
}
import { AppHeader } from "@/components/layout/app-header";
import { adminNav } from "@/components/layout/admin-nav";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requireAdmin();

  const { count: unreadMessageThreads } = await supabase
    .from("message_threads")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gt("admin_unread_count", 0);

  const navItems = adminNav.map((item) =>
    item.href === "/admin/messages"
      ? {
          ...item,
          badge: unreadMessageThreads ?? 0,
        }
      : item,
  );

  return (
    <>
      <AppHeader
        navItems={navItems}
        homeHref="/admin/dashboard"
      />

      {children}
    </>
  );
}
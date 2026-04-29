import { AppHeader } from "@/components/layout/app-header";
import { clientNav } from "@/components/layout/client-nav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader navItems={clientNav} />
      {children}
    </>
  );
}

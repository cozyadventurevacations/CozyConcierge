import Image from "next/image";
import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  badge?: number;
};

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  navItems?: NavItem[];
  homeHref?: string;
};

export function AppHeader({
  title = "Cozy Concierge",
  subtitle = "Powered by Cozy Adventure Vacations",
  navItems = [],
  homeHref = "/trips",
}: AppHeaderProps) {
  return (
    <header
      style={{
        borderBottom: "1px solid #e6f0f2",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href={homeHref}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Image
            src="/cozy-logo.png"
            alt="Cozy Adventure Vacations"
            width={160}
            height={64}
            priority
          />

          <div>
            <strong style={{ display: "block", fontSize: 18 }}>{title}</strong>
            <span style={{ display: "block", fontSize: 13, color: "#667085" }}>
              {subtitle}
            </span>
          </div>
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {navItems.map((item) => {
            const badge = Number(item.badge ?? 0);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  borderRadius: 999,
                  padding: "8px 12px",
                  textDecoration: "none",
                  color: "var(--accent-dark)",
                  fontWeight: 800,
                  fontSize: 14,
                  background: "#f7fbfc",
                  border: "1px solid #e6f0f2",
                }}
              >
                <span>{item.label}</span>

                {badge > 0 ? (
                  <span
                    aria-label={`${badge} unread`}
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 999,
                      padding: "0 6px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#c2410c",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
import Image from "next/image";
import Link from "next/link";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  navItems?: Array<{ href: string; label: string }>;
  homeHref?: string;
};

export function AppHeader({
  title = "Cozy Concierge",
  subtitle = "Powered by Cozy Adventure Vacations",
  navItems = [],
  homeHref = "/trips",
}: AppHeaderProps) {
  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "white" }}>
      <div
        className="container row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <Link
          href={homeHref}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "inherit",
            textDecoration: "none",
          }}
          aria-label="Cozy Concierge home"
        >
          <Image
            src="/cozy-logo.png"
            alt="Cozy Adventure Vacations"
            width={160}
            height={54}
            style={{
              height: 54,
              width: "auto",
              display: "block",
              objectFit: "contain",
            }}
            priority
          />

          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{title}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              {subtitle}
            </div>
          </div>
        </Link>

        <nav
          className="row"
          aria-label="Primary navigation"
          style={{
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ color: "var(--muted)", fontWeight: 600 }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
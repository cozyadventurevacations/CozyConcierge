import Image from "next/image";
import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showLogo?: boolean;
};

export function PageShell({
  title,
  subtitle,
  children,
  showLogo = false,
}: PageShellProps) {
  return (
    <main className="container stack">
      <section
        style={{
          textAlign: showLogo ? "center" : "left",
        }}
      >
        {showLogo ? (
          <div style={{ marginBottom: 18 }}>
            <Image
              src="/cozy-logo.png"
              alt="Cozy Adventure Vacations"
              width={320}
              height={160}
              priority
              style={{
                height: 120,
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        ) : null}

        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </section>

      {children}
    </main>
  );
}
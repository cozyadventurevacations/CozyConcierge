import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cozy Concierge",
  description: "Cozy Concierge powered by Cozy Adventure Vacations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

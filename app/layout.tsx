import "./globals.css";
import type { Metadata } from "next";
import { InteractionFeedback } from "@/components/layout/interaction-feedback";

export const metadata: Metadata = {
  title: "Cozy Concierge",
  description: "Cozy Concierge powered by Cozy Adventure Vacations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <InteractionFeedback />
        {children}
      </body>
    </html>
  );
}

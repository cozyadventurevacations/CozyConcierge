import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Cozy Concierge",
  description: "How Cozy Adventure Vacations collects, uses, protects, and deletes Cozy Concierge user data.",
};

const dataCategories = [
  {
    title: "Account and contact details",
    body: "Name, email address, phone number, login account details, notification preferences, and related profile information.",
  },
  {
    title: "Travel planning details",
    body: "Trip requests, destinations, travel dates, traveler counts, budget notes, travel preferences, accessibility notes, loyalty numbers, emergency contacts, and other information you choose to provide for planning or servicing travel.",
  },
  {
    title: "Travel documents and identity information",
    body: "Documents or fields you upload or enter, such as passport details, traveler forms, authorization documents, booking documents, payment request documents, receipts, and related notes.",
  },
  {
    title: "Trip, message, and Travel Circle content",
    body: "Messages with your advisor, shared trip access records, Travel Circle invitations, trip documents, payment reminders, approvals, and activity needed to provide the client portal.",
  },
  {
    title: "Technical and security information",
    body: "Authentication/session data, IP-derived request information, device/browser details, logs, rate-limit records, bot-protection results, and security events needed to operate and protect the service.",
  },
];

const partners = [
  "Supabase, for authentication, database, file storage, and server infrastructure.",
  "Resend, for transactional and trip-related email delivery.",
  "OpenAI, for Ask Cozy, text rewriting, and document/receipt extraction features when those tools are used.",
  "Cloudflare Turnstile, for registration and form abuse protection.",
  "Google Places/Maps APIs, for address, airport, hotel, and place lookup features.",
  "Travel suppliers and service providers when needed to quote, book, manage, or support requested travel.",
];

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="How Cozy Adventure Vacations handles information in Cozy Concierge."
      showLogo
    >
      <div className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-dark)", fontWeight: 800 }}>
            Cozy Adventure Vacations LLC
          </p>
          <h2 style={{ margin: "6px 0 0" }}>Cozy Concierge User Data Privacy Policy</h2>
          <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>
            Effective July 22, 2026. This policy explains what information Cozy Concierge collects, how it is used, who it may be shared with, how long it is kept, and how you can request access, changes, or deletion.
          </p>
        </div>
      </div>

      <div className="card stack" style={{ border: "1px solid #e6f0f2", background: "#f7fbfc" }}>
        <h2 style={{ margin: 0 }}>Information We Collect</h2>
        <div className="grid grid-2">
          {dataCategories.map((category) => (
            <div key={category.title} className="card" style={{ background: "#ffffff" }}>
              <h3 style={{ margin: 0, color: "var(--accent-dark)" }}>{category.title}</h3>
              <p style={{ margin: "8px 0 0", color: "#667085", lineHeight: 1.6 }}>{category.body}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>How We Use Information</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Cozy Adventure Vacations uses information to create and secure your account, plan requested travel, manage trips, share documents, send service messages, respond to client requests, process approvals, support Travel Circle access, maintain business records, improve app reliability, prevent abuse, and comply with legal, supplier, accounting, and security obligations.
        </p>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Cozy Concierge does not sell personal information. The portal is intended for travel planning and client service, not third-party advertising.
        </p>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Service Providers and Sharing</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Information may be shared with trusted providers only as needed to operate Cozy Concierge, communicate with you, protect the service, or provide requested travel services. These providers are expected to protect user data in a manner consistent with this policy and applicable requirements.
        </p>
        <ul style={{ margin: 0, paddingLeft: 22, color: "#667085", lineHeight: 1.7 }}>
          {partners.map((partner) => (
            <li key={partner}>{partner}</li>
          ))}
        </ul>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Sensitive Travel Documents</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Travel documents can include sensitive identity and itinerary information. Upload documents only when they are needed for travel planning, booking, payment support, or trip service. Do not send full credit card numbers, bank account numbers, or unnecessary sensitive information through messages or uploads unless your advisor specifically provides a secure process for that information.
        </p>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Retention, Deletion, and Your Choices</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Cozy Adventure Vacations keeps information while your account, trip, service request, supplier obligation, accounting record, security need, or legal requirement remains active. Some records may need to be retained after a trip for business, tax, dispute, fraud-prevention, supplier, or legal reasons.
        </p>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          You may request access, correction, export, account deletion, document deletion, or a change to non-essential communication preferences by contacting your advisor or emailing <a href="mailto:jeremyb@cozyadventurevacations.com">jeremyb@cozyadventurevacations.com</a>. Deletion requests will be honored when possible, subject to legal, supplier, security, and business-record retention requirements.
        </p>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Security</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Cozy Concierge uses authenticated access, role-based permissions, database security policies, restricted document links, and operational safeguards to help protect information. No online service can guarantee absolute security, so please use a strong password and contact Cozy Adventure Vacations promptly if you believe your account or documents may be at risk.
        </p>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Children and Traveler Information</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          Cozy Concierge is intended for clients and authorized travelers, not for unsupervised use by children. Adults may provide traveler information for minors when needed for family or group travel planning. If you believe a child provided information without appropriate permission, contact Cozy Adventure Vacations so it can be reviewed.
        </p>
      </section>

      <section className="card stack" style={{ border: "1px solid #e6f0f2", background: "#ffffff" }}>
        <h2 style={{ margin: 0 }}>Changes to This Policy</h2>
        <p style={{ margin: 0, color: "#667085", lineHeight: 1.7 }}>
          This policy may be updated as Cozy Concierge features, service providers, legal requirements, or business practices change. The effective date will be updated when material changes are made.
        </p>
      </section>

      <div className="row">
        <Link href="/login" className="btn btn-outline">
          Back to Login
        </Link>
        <Link href="/travel-request" className="btn btn-primary">
          Request a Trip
        </Link>
      </div>
    </PageShell>
  );
}

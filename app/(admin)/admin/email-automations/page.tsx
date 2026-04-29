import { PageShell } from "@/components/layout/page-shell";

export default function AdminEmailAutomationsPage() {
  return (
    <PageShell title="Email Automations" subtitle="Manage templates and scheduled emails.">
      <table className="table">
        <thead><tr><th>Template</th><th>Type</th><th>Status</th></tr></thead>
        <tbody><tr><td>Final Payment Reminder</td><td>final_payment_10</td><td>Active</td></tr></tbody>
      </table>
    </PageShell>
  );
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  cleanMailingText,
  getMailingName,
  hasCompleteMailingAddress,
  mailingClientSelect,
  sortMailingClients,
  type MailingClient,
} from "@/lib/mailing/clients";

const csvHeaders = [
  "Full Name",
  "First Name",
  "Last Name",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "ZIP",
  "Country",
  "Email",
  "Phone",
];

function csvCell(value: string | null | undefined) {
  const text = cleanMailingText(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("client_accounts")
    .select(mailingClientSelect);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clients = sortMailingClients(((data ?? []) as MailingClient[]).filter(hasCompleteMailingAddress));
  const rows = clients.map((client) => [
    getMailingName(client),
    client.first_name,
    client.last_name,
    client.address_line_1,
    client.address_line_2,
    client.city,
    client.state,
    client.postal_code,
    "US",
    client.email,
    client.phone_primary,
  ]);

  const csv = `\uFEFF${[
    csvHeaders.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n")}`;

  const exportedAt = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="cozy-client-mailing-list-${exportedAt}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

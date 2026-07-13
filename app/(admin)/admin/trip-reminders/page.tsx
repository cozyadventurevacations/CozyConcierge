import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

type TripRow = {
  id: string;
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
  trip_status: string | null;
  balance_due: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid: boolean | null;
  final_payment_due_date: string | null;
};

type TripReminderRow = {
  id: string;
  trip_id: string;
  reminder_type: string | null;
  title: string | null;
  notes: string | null;
  reminder_date: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  trips:
    | Pick<TripRow, "id" | "trip_name" | "destinations" | "departure_date">
    | Pick<TripRow, "id" | "trip_name" | "destinations" | "departure_date">[]
    | null;
};

type ReminderItem = {
  id: string;
  source: "auto" | "custom";
  tripId: string;
  tripName: string;
  destinations: string | null;
  departureDate: string | null;
  title: string;
  notes: string | null;
  reminderDate: string;
  tone: "danger" | "warning" | "neutral";
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "Not set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function isPastDue(value: string | null | undefined, todayStr: string) {
  return Boolean(value) && value! < todayStr;
}

function getReminderSetupMessage(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "");
  if (
    message.includes("trip_reminders") ||
    message.includes("schema cache") ||
    message.includes("Could not find")
  ) {
    return "Custom trip reminders are not fully set up in Supabase yet. Run scripts/setup-trip-reminders.sql in the Supabase SQL Editor to enable custom reminders.";
  }
  return null;
}

function getTripFromReminder(row: TripReminderRow) {
  if (Array.isArray(row.trips)) return row.trips[0] ?? null;
  return row.trips ?? null;
}

function buildAutomaticReminders(trips: TripRow[], todayStr: string, horizonStr: string): ReminderItem[] {
  return trips.flatMap((trip) => {
    const items: ReminderItem[] = [];
    const tripName = trip.trip_name ?? "Trip";

    if (trip.deposit_paid !== true && trip.deposit_due_date && trip.deposit_due_date <= horizonStr) {
      items.push({
        id: `deposit-${trip.id}`,
        source: "auto",
        tripId: trip.id,
        tripName,
        destinations: trip.destinations,
        departureDate: trip.departure_date,
        title: isPastDue(trip.deposit_due_date, todayStr) ? "Deposit past due" : "Deposit due soon",
        notes: `${formatMoney(trip.deposit_amount)} deposit due ${formatDate(trip.deposit_due_date)}.`,
        reminderDate: trip.deposit_due_date,
        tone: isPastDue(trip.deposit_due_date, todayStr) ? "danger" : "warning",
      });
    }

    if (Number(trip.balance_due ?? 0) > 0 && trip.final_payment_due_date && trip.final_payment_due_date <= horizonStr) {
      items.push({
        id: `final-${trip.id}`,
        source: "auto",
        tripId: trip.id,
        tripName,
        destinations: trip.destinations,
        departureDate: trip.departure_date,
        title: isPastDue(trip.final_payment_due_date, todayStr) ? "Final payment past due" : "Final payment due soon",
        notes: `${formatMoney(trip.balance_due)} balance due ${formatDate(trip.final_payment_due_date)}.`,
        reminderDate: trip.final_payment_due_date,
        tone: isPastDue(trip.final_payment_due_date, todayStr) ? "danger" : "warning",
      });
    }

    return items;
  });
}

async function updateTripReminderStatus(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const reminderId = String(formData.get("reminder_id") ?? "").trim();
  const isCompleted = String(formData.get("is_completed") ?? "") === "true";

  if (!reminderId) throw new Error("Missing reminder ID.");

  const { error } = await supabase
    .from("trip_reminders" as any)
    .update({ is_completed: isCompleted })
    .eq("id", reminderId);

  if (error) throw new Error(getReminderSetupMessage(error) ?? error.message);

  revalidatePath("/admin/trip-reminders");
}

export default async function AdminTripRemindersPage() {
  const { supabase } = await requireAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = todayDateString();
  const horizonStr = addDays(today, 30).toISOString().slice(0, 10);

  const [tripsResult, customResult] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_name, destinations, departure_date, return_date, trip_status, balance_due, deposit_amount, deposit_due_date, deposit_paid, final_payment_due_date")
      .in("trip_status", ["draft", "quoted", "reserved", "confirmed", "pending_final_payment", "paid_in_full"])
      .order("departure_date", { ascending: true }),
    supabase
      .from("trip_reminders" as any)
      .select("id, trip_id, reminder_type, title, notes, reminder_date, is_completed, created_at, trips(id, trip_name, destinations, departure_date)")
      .eq("is_completed", false)
      .order("reminder_date", { ascending: true }),
  ]);

  const tripRows = (tripsResult.data ?? []) as TripRow[];
  const autoReminders = buildAutomaticReminders(tripRows, todayStr, horizonStr);
  const customSetupMessage = getReminderSetupMessage(customResult.error);
  const customRows = customSetupMessage ? [] : ((customResult.data ?? []) as TripReminderRow[]);
  const customReminders: ReminderItem[] = customRows
    .filter((row) => row.reminder_date)
    .map((row) => {
      const trip = getTripFromReminder(row);
      const reminderDate = row.reminder_date!;
      return {
        id: row.id,
        source: "custom",
        tripId: row.trip_id,
        tripName: trip?.trip_name ?? "Trip",
        destinations: trip?.destinations ?? null,
        departureDate: trip?.departure_date ?? null,
        title: row.title ?? "Trip reminder",
        notes: row.notes,
        reminderDate,
        tone: isPastDue(reminderDate, todayStr) ? "danger" : reminderDate <= addDays(today, 7).toISOString().slice(0, 10) ? "warning" : "neutral",
      };
    });

  const reminders = [...autoReminders, ...customReminders].sort((a, b) =>
    a.reminderDate.localeCompare(b.reminderDate) || a.tripName.localeCompare(b.tripName),
  );
  const overdueCount = reminders.filter((reminder) => reminder.reminderDate < todayStr).length;
  const dueThisWeekCount = reminders.filter((reminder) => reminder.reminderDate >= todayStr && reminder.reminderDate <= addDays(today, 7).toISOString().slice(0, 10)).length;

  return (
    <PageShell title="Trip Reminders" subtitle="Advisor reminders for important trip dates, payments, and trip-specific tasks.">
      <div className="row">
        <Link href="/admin/dashboard" className="btn btn-primary">Dashboard</Link>
        <Link href="/admin/trips" className="btn btn-outline">Trips</Link>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="label">Open Reminders</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900 }}>{reminders.length}</p>
        </div>
        <div className="card">
          <span className="label">Overdue</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: overdueCount > 0 ? "#be123c" : "#027a48" }}>{overdueCount}</p>
        </div>
        <div className="card">
          <span className="label">Due This Week</span>
          <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: dueThisWeekCount > 0 ? "#c2410c" : "#027a48" }}>{dueThisWeekCount}</p>
        </div>
      </div>

      {tripsResult.error ? (
        <div className="card">
          <p><strong>Error loading automatic trip reminders:</strong></p>
          <pre>{JSON.stringify(tripsResult.error, null, 2)}</pre>
        </div>
      ) : null}

      {customSetupMessage ? (
        <div className="card" style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>{customSetupMessage}</p>
        </div>
      ) : customResult.error ? (
        <div className="card">
          <p><strong>Error loading custom reminders:</strong></p>
          <pre>{JSON.stringify(customResult.error, null, 2)}</pre>
        </div>
      ) : null}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Reminder Queue</h2>
        {reminders.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No trip reminders need attention right now.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Type</th>
                  <th>Trip</th>
                  <th>Reminder</th>
                  <th>Departure</th>
                  <th>Open</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((reminder) => (
                  <tr key={`${reminder.source}-${reminder.id}`}>
                    <td style={{ fontWeight: 900, color: reminder.tone === "danger" ? "#be123c" : reminder.tone === "warning" ? "#c2410c" : "inherit" }}>
                      {formatDate(reminder.reminderDate)}
                    </td>
                    <td>{reminder.source === "auto" ? "Automatic" : "Custom"}</td>
                    <td>
                      <strong>{reminder.tripName}</strong>
                      <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>{reminder.destinations ?? "Destination not set"}</span>
                    </td>
                    <td>
                      <strong>{reminder.title}</strong>
                      {reminder.notes ? <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>{reminder.notes}</span> : null}
                    </td>
                    <td>{formatDate(reminder.departureDate)}</td>
                    <td>
                      <Link href={`/admin/trips/${reminder.tripId}#advisor-reminders`} className="btn btn-primary" style={{ padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap" }}>
                        Open Trip
                      </Link>
                    </td>
                    <td>
                      {reminder.source === "custom" ? (
                        <form action={updateTripReminderStatus}>
                          <input type="hidden" name="reminder_id" value={reminder.id} />
                          <input type="hidden" name="is_completed" value="true" />
                          <button type="submit" className="btn btn-outline" style={{ padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap" }}>
                            Complete
                          </button>
                        </form>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: 13 }}>Updates from trip fields</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

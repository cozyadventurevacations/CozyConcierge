import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageShell } from "@/components/layout/page-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function updateTravelerInformation(formData: FormData) {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !userProfile) {
    throw new Error("User profile not found.");
  }

  const { data: clientAccount, error: clientError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("user_profile_id", userProfile.id)
    .single();

  if (clientError || !clientAccount) {
    throw new Error("Client account not found.");
  }

  const updates = {
    passport_full_name: String(formData.get("passport_full_name") ?? "").trim() || null,
    passport_number: String(formData.get("passport_number") ?? "").trim() || null,
    passport_issuing_country: String(formData.get("passport_issuing_country") ?? "").trim() || null,
    passport_expiration_date:
      String(formData.get("passport_expiration_date") ?? "").trim() || null,
    known_traveler_number:
      String(formData.get("known_traveler_number") ?? "").trim() || null,
    redress_number: String(formData.get("redress_number") ?? "").trim() || null,
    loyalty_brand: String(formData.get("loyalty_brand") ?? "").trim() || null,
    loyalty_number: String(formData.get("loyalty_number") ?? "").trim() || null,
    allergies: String(formData.get("allergies") ?? "").trim() || null,
    special_accommodations:
      String(formData.get("special_accommodations") ?? "").trim() || null,
    hotel_preference: String(formData.get("hotel_preference") ?? "").trim() || null,
    airline_preference: String(formData.get("airline_preference") ?? "").trim() || null,
    seating_preference: String(formData.get("seating_preference") ?? "").trim() || null,
  };

  const { data: existingTraveler, error: existingError } = await supabase
    .from("traveler_details")
    .select("id")
    .eq("client_account_id", clientAccount.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTraveler) {
    const { error: updateError } = await supabase
      .from("traveler_details")
      .update(updates)
      .eq("id", existingTraveler.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase
      .from("traveler_details")
      .insert({
        client_account_id: clientAccount.id,
        ...updates,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidatePath("/traveler-information");
}

export default async function TravelerInformationPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: userProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !userProfile) {
    return (
      <PageShell
        title="Traveler Information"
        subtitle="We could not find your user profile."
      >
        <div className="card">
          <p>User profile not found.</p>
        </div>
      </PageShell>
    );
  }

  const { data: clientAccount, error: clientError } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("user_profile_id", userProfile.id)
    .single();

  if (clientError || !clientAccount) {
    return (
      <PageShell
        title="Traveler Information"
        subtitle="We could not find your client account."
      >
        <div className="card">
          <p>Client account not found.</p>
        </div>
      </PageShell>
    );
  }

  const { data: travelerDetails, error: travelerError } = await supabase
    .from("traveler_details")
    .select("*")
    .eq("client_account_id", clientAccount.id)
    .maybeSingle();

  if (travelerError) {
    return (
      <PageShell
        title="Traveler Information"
        subtitle="There was a problem loading traveler details."
      >
        <div className="card">
          <p>{travelerError.message}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Traveler Information"
      subtitle="Keep your travel details up to date so planning stays smooth."
    >
      <form action={updateTravelerInformation} className="card stack">
        <div className="grid grid-2">
          <label>
            <span className="label">Passport Full Name</span>
            <input
              className="input"
              name="passport_full_name"
              defaultValue={travelerDetails?.passport_full_name ?? ""}
            />
          </label>

          <label>
            <span className="label">Passport Number</span>
            <input
              className="input"
              name="passport_number"
              defaultValue={travelerDetails?.passport_number ?? ""}
            />
          </label>

          <label>
            <span className="label">Passport Issuing Country</span>
            <input
              className="input"
              name="passport_issuing_country"
              defaultValue={travelerDetails?.passport_issuing_country ?? ""}
            />
          </label>

          <label>
            <span className="label">Passport Expiration Date</span>
            <input
              className="input"
              type="date"
              name="passport_expiration_date"
              defaultValue={travelerDetails?.passport_expiration_date ?? ""}
            />
          </label>

          <label>
            <span className="label">Known Traveler Number</span>
            <input
              className="input"
              name="known_traveler_number"
              defaultValue={travelerDetails?.known_traveler_number ?? ""}
            />
          </label>

          <label>
            <span className="label">Redress Number</span>
            <input
              className="input"
              name="redress_number"
              defaultValue={travelerDetails?.redress_number ?? ""}
            />
          </label>

          <label>
            <span className="label">Loyalty Brand</span>
            <input
              className="input"
              name="loyalty_brand"
              defaultValue={travelerDetails?.loyalty_brand ?? ""}
            />
          </label>

          <label>
            <span className="label">Loyalty Number</span>
            <input
              className="input"
              name="loyalty_number"
              defaultValue={travelerDetails?.loyalty_number ?? ""}
            />
          </label>

          <label>
            <span className="label">Hotel Preference</span>
            <input
              className="input"
              name="hotel_preference"
              defaultValue={travelerDetails?.hotel_preference ?? ""}
            />
          </label>

          <label>
            <span className="label">Airline Preference</span>
            <input
              className="input"
              name="airline_preference"
              defaultValue={travelerDetails?.airline_preference ?? ""}
            />
          </label>

          <label>
            <span className="label">Seating Preference</span>
            <input
              className="input"
              name="seating_preference"
              defaultValue={travelerDetails?.seating_preference ?? ""}
            />
          </label>
        </div>

        <label>
          <span className="label">Allergies</span>
          <textarea
            className="textarea"
            name="allergies"
            defaultValue={travelerDetails?.allergies ?? ""}
          />
        </label>

        <label>
          <span className="label">Special Accommodations or Needs</span>
          <textarea
            className="textarea"
            name="special_accommodations"
            defaultValue={travelerDetails?.special_accommodations ?? ""}
          />
        </label>

        <div className="row">
          <button type="submit" className="btn btn-primary">
            Save Traveler Information
          </button>
        </div>
      </form>
    </PageShell>
  );
}
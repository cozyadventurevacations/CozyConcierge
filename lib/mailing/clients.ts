export type MailingClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_primary: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export const mailingClientSelect =
  "id, first_name, last_name, preferred_name, email, phone_primary, address_line_1, address_line_2, city, state, postal_code";

export function cleanMailingText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getMailingName(client: MailingClient) {
  return (
    [client.first_name, client.last_name].map(cleanMailingText).filter(Boolean).join(" ") ||
    cleanMailingText(client.preferred_name) ||
    cleanMailingText(client.email) ||
    "Unnamed Client"
  );
}

export function getCityStatePostal(client: MailingClient) {
  const city = cleanMailingText(client.city);
  const state = cleanMailingText(client.state);
  const postalCode = cleanMailingText(client.postal_code);

  if (city && state && postalCode) return `${city}, ${state} ${postalCode}`;
  if (city && state) return `${city}, ${state}`;
  return [city, state, postalCode].filter(Boolean).join(" ");
}

export function getMailingLines(client: MailingClient) {
  return [
    getMailingName(client),
    cleanMailingText(client.address_line_1),
    cleanMailingText(client.address_line_2),
    getCityStatePostal(client),
  ].filter(Boolean);
}

export function hasCompleteMailingAddress(client: MailingClient) {
  return Boolean(
    cleanMailingText(client.address_line_1) &&
      cleanMailingText(client.city) &&
      cleanMailingText(client.state) &&
      cleanMailingText(client.postal_code),
  );
}

export function sortMailingClients(clients: MailingClient[]) {
  return [...clients].sort((a, b) => {
    const lastNameCompare = cleanMailingText(a.last_name).localeCompare(cleanMailingText(b.last_name));
    if (lastNameCompare !== 0) return lastNameCompare;

    const firstNameCompare = cleanMailingText(a.first_name).localeCompare(cleanMailingText(b.first_name));
    if (firstNameCompare !== 0) return firstNameCompare;

    return getMailingName(a).localeCompare(getMailingName(b));
  });
}


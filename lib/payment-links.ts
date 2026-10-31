export type HostPaylinkRequest = {
  id: string;
  status: string | null;
  requested_amount: number | null;
  requested_payment_date: string | null;
  payment_link_url: string | null;
};

export function normalizeHostPaylink(value: string): string {
  const input = value.trim();
  if (!input || input.length > 8192 || /[\s\u0000-\u001f\u007f\\]/u.test(input)) {
    throw new Error("Paste the complete HTTPS paylink provided by your host agency.");
  }
  let url: URL;
  try { url = new URL(input); } catch {
    throw new Error("Enter a valid HTTPS paylink, starting with https://.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || !/^https:\/\//i.test(input) || url.username || url.password ||
      !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") ||
      /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) {
    throw new Error("Use an HTTPS paylink on your host agency's public payment website, without a username or password in the link.");
  }
  // Keep the supplied URL intact: payment providers may sign its path and query.
  return input;
}

export function availableHostPaylink(request: HostPaylinkRequest): string | null {
  if (request.status !== "sent" || !request.payment_link_url) return null;
  try { return normalizeHostPaylink(request.payment_link_url); } catch { return null; }
}

export function validateHostPaylinkDetails(amount: string, date: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 9999999999.99) {
    throw new Error("Enter a payment amount greater than zero with at most two decimal places.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("Enter a valid requested payment date.");
  }
  return { requested_amount: Number(amount), requested_payment_date: date };
}

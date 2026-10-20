export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  const target = new URL(value, "https://app.invalid");
  return target.origin === "https://app.invalid" ? target.pathname + target.search + target.hash : fallback;
}

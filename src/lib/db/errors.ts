export function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    code === "23505" ||
    message.includes("unique") ||
    message.includes("duplicate key") ||
    message.includes("already exists")
  );
}

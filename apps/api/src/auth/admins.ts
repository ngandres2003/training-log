/** Admin emails from `ADMIN_EMAILS` (comma-separated, case-insensitive). Read on every call. */
export function adminEmailsFromEnv(value = process.env.ADMIN_EMAILS): string[] {
  return (value ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string, admins: readonly string[]): boolean {
  return admins.includes(email.trim().toLowerCase())
}

const DSAT_DAILY_OPERATOR_ROLES = new Set(["admin", "supervisor", "senior_agent"]);

export function canAccessDailyDsat(roleKey?: string | null): boolean {
  return Boolean(roleKey && DSAT_DAILY_OPERATOR_ROLES.has(roleKey));
}

export function canCorrectDailyDsat(roleKey?: string | null): boolean {
  return roleKey === "admin" || roleKey === "supervisor";
}

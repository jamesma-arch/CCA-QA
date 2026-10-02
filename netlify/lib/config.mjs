// Return configuration names only. Never include secret values in responses.
export function configurationStatus(env) {
  const missing = ['STAFF_ACCESS_CODE', 'ADMIN_ACCESS_CODE', 'SESSION_SECRET'].filter(key => !env[key]);
  const issues = [];
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) issues.push('SESSION_SECRET must contain at least 32 characters.');
  if (env.STAFF_ACCESS_CODE && env.ADMIN_ACCESS_CODE && env.STAFF_ACCESS_CODE === env.ADMIN_ACCESS_CODE) issues.push('Staff and administrator access codes must be different.');
  return { configured: missing.length === 0 && issues.length === 0, missing, issues };
}

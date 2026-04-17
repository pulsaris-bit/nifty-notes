// Modern password requirements (inspired by NIST 800-63B + common best practice).
// Keep these in sync with the server-side schema in server/src/routes/auth.js.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 100;

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH) errors.push(`Minimaal ${PASSWORD_MIN_LENGTH} tekens`);
  if (pw.length > PASSWORD_MAX_LENGTH) errors.push(`Maximaal ${PASSWORD_MAX_LENGTH} tekens`);
  if (!/[a-z]/.test(pw)) errors.push('Minstens één kleine letter');
  if (!/[A-Z]/.test(pw)) errors.push('Minstens één hoofdletter');
  if (!/[0-9]/.test(pw)) errors.push('Minstens één cijfer');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Minstens één speciaal teken');
  if (/\s/.test(pw)) errors.push('Geen spaties toegestaan');
  return { ok: errors.length === 0, errors };
}

export const PASSWORD_REQUIREMENTS: { label: string; test: (pw: string) => boolean }[] = [
  { label: `Minimaal ${PASSWORD_MIN_LENGTH} tekens`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { label: 'Een kleine letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Een hoofdletter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Een cijfer (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'Een speciaal teken (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordRequirements =
  'Use 10–128 characters, including an uppercase letter, a number, and a special character.';
export function validNewPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 10 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password)
  );
}

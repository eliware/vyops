export function validatePassword(password) {
  if (!password) throw new Error("password-stdin received an empty password");
  return password;
}

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D+/g, '').slice(0, 15);
}

export function sanitizeAreaInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) {
    return whole;
  }

  return `${whole}.${rest.join('')}`;
}

export function sanitizePersonName(value: string) {
  return value
    .replace(/[^\p{L}\s\-'.]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 50);
}

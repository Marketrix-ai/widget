/**
 * `randomId` mints a random RFC 4122 v4 UUID for chat message, recording-session and tab ids.
 * It builds on `crypto.getRandomValues` because `crypto.randomUUID` exists only in secure contexts, and the
 * widget also runs on plain-http host pages.
 */
export function randomId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, i) =>
    (i === 6 ? (byte & 0x0f) | 0x40 : i === 8 ? (byte & 0x3f) | 0x80 : byte).toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

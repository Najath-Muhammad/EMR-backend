/**
 * Utility functions for normalizing and formatting telephone numbers.
 */

/**
 * Normalizes a phone number for indexing and duplicate search.
 * Strips all non-digit characters, removes leading zeros, and normalizes
 * 11-digit numbers starting with country code '1' to 10-digit national format.
 * Example: "+1 (555) 234-5678" -> "5552345678"
 * Example: "0555-123-456" -> "555123456"
 * Example: "555.234.5678" -> "5552345678"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  // Normalize 11-digit phone numbers with leading country code '1'
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Formats a phone number for readable display in the UI.
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = normalizePhoneNumber(phone);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

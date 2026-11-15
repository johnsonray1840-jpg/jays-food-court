/**
 * JAY'S FOOD COURT (JFC) - SECURITY SANITIZATION UTILITY
 * Sanitizes customer-generated content before storage and rendering
 * Prevents Cross-Site Scripting (XSS), script injection, and control code attacks.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;'
};

/**
 * Strips HTML tags and script payloads, then escapes special characters.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return '';
    return String(input);
  }

  // 1. Strip entire <script>...</script> and <style>...</style> blocks
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // 2. Strip remaining HTML tags like <img>, <iframe>, <a>, <div>
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // 3. Remove ASCII control characters (except newline, tab)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Escape remaining HTML entities for rendering safety
  cleaned = cleaned.replace(/[&<>"'`\/]/g, (s) => HTML_ENTITY_MAP[s] || s);

  return cleaned.trim();
}

/**
 * Sanitizes all customer-supplied fields on an incoming order payload.
 */
export function sanitizeCustomerOrderInput<T extends Record<string, any>>(input: T): T {
  const result: any = { ...input };

  if (typeof result.customerName === 'string') {
    result.customerName = sanitizeText(result.customerName);
  }

  if (typeof result.address === 'string') {
    result.address = sanitizeText(result.address);
  }

  if (typeof result.landmark === 'string') {
    result.landmark = sanitizeText(result.landmark);
  }

  if (typeof result.deliveryInstructions === 'string') {
    result.deliveryInstructions = sanitizeText(result.deliveryInstructions);
  }

  if (Array.isArray(result.items)) {
    result.items = result.items.map((item: any) => {
      const sanitizedItem = { ...item };
      if (typeof sanitizedItem.note === 'string') {
        sanitizedItem.note = sanitizeText(sanitizedItem.note);
      }
      if (typeof sanitizedItem.notes === 'string') {
        sanitizedItem.notes = sanitizeText(sanitizedItem.notes);
      }
      return sanitizedItem;
    });
  }

  return result as T;
}

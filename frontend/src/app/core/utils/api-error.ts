interface ApiErrorBody {
  error?: string;
  details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
}

/**
 * The backend's error middleware returns { error: 'Validation failed', details: <zod flatten> }
 * for schema violations - the top-level `error` string alone ("Validation failed") tells the
 * user nothing about which field was wrong. This surfaces the actual field-level reasons when
 * present, falling back to the plain error message or a caller-supplied fallback.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const body = (err as { error?: ApiErrorBody })?.error;
  if (!body) return fallback;

  const parts: string[] = [];
  if (body.details?.fieldErrors) {
    for (const [field, messages] of Object.entries(body.details.fieldErrors)) {
      if (messages?.length) parts.push(`${field}: ${messages.join(', ')}`);
    }
  }
  if (body.details?.formErrors?.length) {
    parts.push(...body.details.formErrors);
  }
  if (parts.length > 0) return parts.join('; ');
  return body.error ?? fallback;
}

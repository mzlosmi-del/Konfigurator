// Structured error logger for Edge Functions.
// Emits a single JSON line per error so Supabase log search can parse + alert.
// Sentry's Deno SDK is not stable enough for production yet — when it is,
// swap the console.error here for Sentry.captureException + extras.
//
// NOTE: dashboard-deployed functions cannot pull from this _shared/ folder,
// so each function inlines the equivalent try/catch + console.error block
// rather than importing from here. This file is the canonical reference for
// the log shape — keep field names in sync if you change them.

export function logError(
  fn: string,
  err: unknown,
  ctx: Record<string, unknown> = {},
): void {
  const payload = {
    severity: 'error',
    function: fn,
    error:    err instanceof Error ? err.message : String(err),
    stack:    err instanceof Error ? err.stack   : undefined,
    ...ctx,
  }
  console.error(JSON.stringify(payload))
}

// Outer safety net for Deno.serve handlers — logs anything that escapes
// the function's own error handling, then rethrows so Deno's default
// 500 response is preserved.
export function withErrorLogging(
  fn: string,
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (err) {
      logError(fn, err)
      throw err
    }
  }
}

/**
 * Decoding for the JSON shape `cvToJSON` produces.
 *
 * A node looks like `{ type: '<clarity type signature>', value: ... }`, and the
 * signature is the *whole recursive type*, not just the outer constructor:
 *
 *   (tuple (addr principal) (decimals uint) (oracle (tuple (callcode (optional none)) ...)))
 *
 * Earlier versions of this decoder matched that string with `includes()`, which
 * reads a nested type as if it were the node's own. A tuple containing any
 * `(optional none)` anywhere inside it therefore decoded as Clarity `none`, and
 * the whole tuple was discarded. That silently broke reads of real Zest assets
 * (sBTC, STX and USDC all have `(callcode (optional none))`) and could do the
 * same to any risk policy tuple holding an empty optional.
 *
 * So kind detection here is anchored to the leading constructor only, and
 * emptiness is decided by the value being null rather than by the word "none"
 * appearing somewhere in a type signature.
 */

/** The outermost Clarity type constructor, e.g. `(optional none)` -> `optional`. */
export function clarityKind(type: string): string {
  const trimmed = type.trim();
  if (!trimmed.startsWith('(')) return trimmed.toLowerCase();
  const head = trimmed.slice(1).split(/[\s()]/, 1)[0] ?? '';
  return head.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collapses a cvToJSON tree into plain JS values. */
export function unwrapClarity(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(unwrapClarity);
  if (!isRecord(input)) return input;

  // A tuple's fields arrive as a plain `{ field: node }` map with no `type` of
  // its own. Note this also covers a tuple that genuinely has a field *named*
  // "type", because then `input.type` is a node object rather than a string.
  if (typeof input['type'] !== 'string') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, unwrapClarity(value)]),
    );
  }

  const kind = clarityKind(input['type']);

  if (kind === 'none') return null;
  if (kind === 'optional') {
    return input['value'] === null || input['value'] === undefined
      ? null
      : unwrapClarity(input['value']);
  }

  // Everything else — response, tuple, list, some, uint, int, bool, principal,
  // buff, string-ascii, string-utf8 — carries its payload in `value`.
  if ('value' in input) return unwrapClarity(input['value']);

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, unwrapClarity(value)]),
  );
}

export interface ClarityResponse {
  ok: boolean;
  value: unknown;
}

/**
 * Splits a Clarity `(response ok err)` into its branch and payload. `cvToJSON`
 * reports the branch with a `success` boolean; anything that is not a response
 * is treated as a bare value, which is what read-only calls returning a plain
 * type give us.
 */
export function unwrapClarityResponse(input: unknown): ClarityResponse {
  if (!isRecord(input)) return { ok: true, value: unwrapClarity(input) };
  if (typeof input['type'] === 'string' && clarityKind(input['type']) === 'response') {
    return { ok: input['success'] !== false, value: unwrapClarity(input['value']) };
  }
  return { ok: true, value: unwrapClarity(input) };
}

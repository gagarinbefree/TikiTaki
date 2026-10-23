/**
 * Check an element against the HTMLElement constructor of its owning document.
 */
export function isHTMLElement(value: unknown): value is HTMLElement {
  if (typeof value !== 'object' || value === null) {
    const result = false;

    return result;
  }
  const candidate = value as Partial<HTMLElement>;
  /** function Object() { [native code] } */
  const constructor = candidate.ownerDocument?.defaultView?.HTMLElement;
  const result = constructor !== undefined && value instanceof constructor;

  return result;
}

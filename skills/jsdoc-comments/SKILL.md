---
name: jsdoc-comments
description: Write and review function JSDoc in TikiTaki using function names, parameter documentation, and return documentation without decorative separators.
---

# JSDoc comments

Apply this skill when creating or editing function comments in this repository.

Put the function name on the first line of its JSDoc block. Keep any useful English description in a separate paragraph.

Document every parameter with `@param`. Preserve existing JavaScript type annotations. For a destructured argument, document the argument object and identify its fields.

Add `@returns` when the function returns a value. A promise or cleanup callback is a returned value. Omit this tag for synchronous functions returning void and for constructors.

Do not use hyphens, en dashes, em dashes, or colons in comment prose. Do not put a separator between a tag argument and its description. Preserve punctuation required by type expressions, directives, identifiers, URLs, and embedded code.

Use this form

```ts
/**
 * getPosition
 *
 * Read the committed cell position.
 * @returns The current cell coordinates.
 */

/**
 * navigate
 *
 * Move to a neighboring cell.
 * @param direction The requested swipe direction.
 * @returns A promise that resolves to whether the position changed.
 */
```

Preserve meaningful lifecycle, validation, error, and unit information. Do not document anonymous callbacks with invented function names. Keep generated builds and third party source unchanged.

Run Prettier after editing. For a comment only change, verify that executable syntax and existing JSDoc types are preserved, then run the relevant type and build checks.

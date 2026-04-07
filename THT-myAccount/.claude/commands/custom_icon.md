# Custom Icon Generator

Create a new custom icon component in `src/templates/CustomIcons/` based on the description below.

**Icon description:** $ARGUMENTS

---

## Step 1 — Determine the component name

Derive a PascalCase component name from the description, ending with `Icon`.
Example: "shopping cart" → `ShoppingCartIcon`.

The SVG inner component is named the same but with `SVG` suffix: `ShoppingCartSVG`.

---

## Step 2 — SVG source

**If `$ARGUMENTS` contains raw SVG markup** (i.e. includes a `<svg` tag) — use it as-is as the SVG source. Skip generation. Extract the `viewBox` from the provided SVG and keep all inner paths/shapes unchanged. Then apply the color rules below to those paths (replace hardcoded fills/strokes with `currentColor` unless the icon is decorative/fixed-color).

**Otherwise** — generate a meaningful, clean SVG for the described icon.

Either way, follow these rules:

### Required SVG attributes on the root `<svg>` element:
```
xmlns="http://www.w3.org/2000/svg"
width="1em"
height="1em"
viewBox="0 0 {W} {H}"   ← pick a clean coordinate space, e.g. 24×24 or 64×64
focusable="false"
data-icon="{icon-name-kebab-case}"
aria-hidden="true"
fill="none"
```

### Color rules (pick one based on design):
- **Filled icon** — use `fill="currentColor"` on paths/shapes (no `stroke`)
- **Outlined icon** — use `stroke="currentColor"` + `strokeWidth` on paths, `fill="none"` on the SVG root
- **Mixed** — combine both where needed
- **Fixed-color icon** (decorative, non-themeable) — use literal hex values like `fill="#8C8C8C"` and fixed pixel `width`/`height` instead of `1em`

Do **not** use inline styles. Do not add `className` to SVG elements.

---

## Step 3 — Write the component file

Create the file at `src/templates/CustomIcons/{ComponentName}.tsx` with this exact structure:

```tsx
import Icon from '@ant-design/icons';
import React, { FC } from 'react';
import { CustomIconProps } from './type';

const {SVGName} = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    focusable="false"
    data-icon="{icon-name-kebab-case}"
    aria-hidden="true"
    fill="none"
  >
    {/* SVG paths */}
  </svg>
);

const {ComponentName}: FC<Partial<CustomIconProps>> = (props) => (
  <Icon
    component={{SVGName}}
    {...props}
  />
);

export default {ComponentName};
```

Rules:
- Imports order: `@ant-design/icons` → `react` → `./type`
- SVG function is a plain arrow function returning JSX (no props, no typing)
- Component uses `FC<Partial<CustomIconProps>>` — always `Partial`
- Spread `{...props}` onto `<Icon>` — never destructure specific props
- Default export only, no named exports from this file

---

## Step 4 — Update index.ts

Read `src/templates/CustomIcons/index.ts`. It has two sections:
1. `import` block at the top (one import per line)
2. `export { ... }` block at the bottom

Add the new icon:
- Append `import {ComponentName} from './{ComponentName}';` to the import block
- Add `{ComponentName},` inside the `export { }` block

Do **not** sort or reorder existing lines — append only.

---

## Constraints

- Do not create an `index.ts` if it does not exist — only update it if present
- Do not create any additional files (no `.module.scss`, no `type.ts`, no `index.ts` for the icon itself)
- Do not add comments or JSDoc to the generated file
- The file must pass the project's ESLint + Prettier config:
  - `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'es5'`, `printWidth: 80`

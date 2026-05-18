# CLAUDE.md — Project Guidelines

## Detailed rules

Read the relevant file before writing code:

- Working on any component → [Component structure & code order](.claude/rules/components.md)
- Using or adding a helper/utility → [Helpers reference](.claude/rules/helpers.md)
- Adding routes or checking permissions → [Routing & permissions](.claude/rules/routing.md)

## Language

- Code, comments, variable names, text in components (placeholder, label, tooltip) — English only

## Stack

- **React** 18.2.0 — functional components only, `FC<Props>` typing
- **TypeScript** 3.7.5 — `strict: true`, use `type` not `interface`
- **Redux** — legacy only: `redux` + `redux-thunk`, switch-case reducers. No `@reduxjs/toolkit`
- **Ant Design** 3.26.5 — icons from `antd` (`Icon` component), `Form.create()` HOC
- **React Router** v5 — `BrowserRouter`, `Route`, `Switch`
- **Axios** — via `helpers/ClientApi` wrapper (JS file), never import axios directly

## TypeScript conventions

- Always use `type` instead of `interface`
- Prefer explicit return types on hooks and complex functions
- Use `FC<Props>` for components
- `LoadStatus = 'loading' | 'loaded' | 'not loaded' | 'error'` is the standard loading state type
- tsconfig target is `es5` — avoid modern runtime features not covered by polyfills

## Imports

- Absolute imports from `src/` (configured via `tsconfig.json` `baseUrl: "src"`)
- Order: React → external packages → Redux → types → internal helpers → relative components → styles
- Never use relative paths that go up more than 2 levels — use absolute instead

## Component conventions

- Functional components only, no class components
- `forwardRef` when DOM access is needed — always set `displayName`
- Props: intersection with HTML attributes when wrapping a DOM element
- Use `classnames` for conditional classes
- Styles: CSS Modules (`.module.scss`), never inline styles except for dynamic values

## Redux — all code is legacy

All Redux code uses the legacy pattern (manual action constants, switch-case reducers, thunks):

```
src/
  actions/          action creators with redux-thunk
  reducers/         switch-case reducers
  store/
    configureStore.ts   store bootstrap
    slices/             also uses legacy pattern — switch-case, NOT RTK
```

There is no `@reduxjs/toolkit` in this project. Do not use `createSlice` or `createAsyncThunk`.

When writing new Redux code, follow the existing switch-case pattern in the nearest similar slice.

## Redux — accessing state

```typescript
import { useAppSelector } from 'hooks/useAppSelector';
import { useAppDispatch } from 'hooks/useAppDispatch';
```

Never import `useSelector` or `useDispatch` directly from `react-redux`.

## API calls

- Always go through `helpers/ClientApi` (Axios instance with auth headers)
- Error handling via `handleError` from `helpers/forActions`
- `ClientApi` is a JavaScript file — import as: `import ClientApi from 'helpers/ClientApi'`

## Ant Design

- Import components from `antd` directly: `import { Button, Form, Table } from 'antd'`
- Import icons from `antd` using the `Icon` component: `import { Icon } from 'antd'` then `<Icon type="close" />`
- Forms: use `Form.create()` HOC pattern (v3 style)
- Do not override AntD styles with inline styles — use Less variables or CSS Modules

## Prettier / ESLint

```
singleQuote: true
tabWidth: 2
trailingComma: 'es5'
printWidth: 80
jsxSingleQuote: false
```

---

## Folder map

```
src/
  actions/        legacy Redux action creators (redux-thunk style)
  assets/         static files
  constants/      app-wide constants, path strings, permission constants
  helpers/
    ClientApi.js  Axios instance with auth headers (JS, not TS)
    forActions.ts handleError helper
    storage.ts    localStorage helpers
    regexp.ts     all project regex patterns
    rulesFields.ts AntD Form validation rule builders
    date.ts       date formatting utilities
    string.ts     string processing utilities
    number.ts     number formatting utilities
    validation.ts validation utilities
    mapping.ts    data mapping utilities
    authWrapper.js LEGACY — route guards (do not modify)
    Utils.js      LEGACY — utility collection (do not modify)
  hooks/          custom React hooks (useAppSelector, useAppDispatch, useQuery...)
  interfaces/     TypeScript types
  pages/          route-level components + routeItems.js + Router.js
  reducers/       legacy switch-case reducers
  selectors/      reselect selectors
  store/
    configureStore.ts store bootstrap
    slices/           domain reducers (legacy switch-case pattern)
  templates/      reusable presentational components
  views/          feature-level components
```

## Folder responsibilities

**`templates/`** — reusable presentational components used across multiple features.
No business logic, no direct Redux access. Receive everything via props.

**`views/`** — feature-level components responsible for a complete piece of functionality.
Connect to Redux, contain business logic, compose `templates/` components.

**`pages/`** — route-level shells. Wire up views, handle route params,
define page layout. Minimal logic — mostly composition.

Rule: templates → views → pages. Never the other way around.
Data flows down, events bubble up.

---

## Legacy files — do not modify without explicit instruction

| Path | Description |
|---|---|
| `helpers/authWrapper.js` | Route guards — legacy JS |
| `helpers/Utils.js` | Legacy utility collection |
| `helpers/ClientApi.js` | Axios instance — JS file, edit only for auth/header changes |
| `src/store/configureStore.ts` | Store bootstrap — do not restructure |

# CLAUDE.md — Project Guidelines

## Detailed rules

Read the relevant file before writing code:

- Working on any component → [Component structure & code order](.claude/rules/components.md)
- Creating or editing a Redux slice → [Redux slice structure](.claude/rules/slice.md)
- Adding routes or checking permissions → [Routing & permissions](.claude/rules/routing.md)
- Using or adding a helper/utility → [Helpers reference](.claude/rules/helpers.md)

## Language

- Code, comments, variable names, text in components (placeholder, label, tooltip) — English only

## Stack

- **React** 18.2.0 — functional components only, `FC<Props>` typing
- **TypeScript** 4.7.4 — `strict: true`, use `type` not `interface`
- **Redux** — mixed: legacy `redux` + `redux-thunk` and modern `@reduxjs/toolkit`
- **Ant Design** 4.24.7 — UI components with custom Less theming
- **React Router** v5 — `BrowserRouter`, `Route`, `Switch`
- **Axios** — via `helpers/ClientApi` wrapper, never import axios directly

## TypeScript conventions

- Always use `type` instead of `interface`
- Prefer explicit return types on hooks and complex functions
- Use `FC<Props>` for components
- Use generic types for reusable patterns: `ResponseSearch<T>`, `LoadStatus`
- `LoadStatus = 'loading' | 'loaded' | 'not loaded' | 'error'` is the standard loading state type

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

## Redux — new code (RTK)

All new state goes into `store/slices/`:

```
store/slices/<domain>/
  slice.ts       — createSlice with reducers and extraReducers
  actions.ts     — createAsyncThunk actions
  selectors.ts   — plain selectors + createSelector for derived state
  types.ts       — domain types
  hooks/         — custom hooks that wrap dispatch + selectors
    use<Domain>.ts
```

- Use `createAsyncThunk` for all async operations
- Handle pending/fulfilled/rejected in `extraReducers`
- Expose Redux logic through slice-specific custom hooks, not raw dispatch in components
- Use `useAppSelector` and `useAppDispatch` from `helpers/hooks/useAppStore`, never raw `useSelector`/`useDispatch`

## Redux — accessing state

```typescript
import { useAppSelector, useAppDispatch } from 'helpers/hooks/useAppStore';
```

Never import `useSelector` or `useDispatch` directly from `react-redux`.

## API calls

- Always go through `helpers/ClientApi` (Axios instance with auth headers)
- Error handling via `handleError` helper
- Pass `access_data` (company_group_id + company_id) via `runWithCompanyGroupId`

## Ant Design

- Import components from `antd` directly: `import { Button, Form } from 'antd'`
- Import icons from `@ant-design/icons`
- Do not override AntD styles with inline styles — use Less variables or CSS Modules

## Prettier / ESLint

```
singleQuote: true
tabWidth: 2
trailingComma: 'es5'
printWidth: 80
jsxSingleQuote: false
singleAttributePerLine: false (default)
```

ESLint notable rules:

- `@typescript-eslint/no-explicit-any`: off (but avoid `any` where possible)
- `@typescript-eslint/ban-ts-comment`: off
- `react-hooks/exhaustive-deps`: off (but handle deps carefully)

---

## Legacy zones

> Do not modify these files or folders without an explicit instruction to do so.
> They use the old Redux pattern (manual action types, switch-case reducers, hand-written thunks).

| Path                          | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `src/actions/`                | ~69 legacy action creators using redux-thunk style                                           |
| `src/reducers/`               | ~80 legacy switch-case reducers                                                              |
| `src/store/configureStore.js` | Old `createStore` store setup — do not migrate without explicit task                         |
| `src/selectors/`              | Legacy reselect selectors tied to old reducers — read-only unless migrating a specific slice |
| `src/interfaces/`             | Many files mix old and new types — edit only the type relevant to the task                   |

When a task touches a legacy zone, implement the new logic in `store/slices/` and connect via hooks. Do not refactor the legacy file itself unless explicitly asked.

---

## Folder map

```
src/
  actions/        LEGACY — old thunk action creators
  assets/         static files
  constants/      app-wide constants and API URL strings
  helpers/
    api/          base HTTP setup
    hooks/        shared custom hooks (useAppStore, useDebounce, etc.)
  interfaces/     shared TypeScript types (mixed legacy/new)
  pages/          route-level components and Router config
  reducers/       LEGACY — old Redux reducers + root reducer index
  selectors/      LEGACY — reselect selectors for old state shape
  store/
    configureStore.js   LEGACY — store bootstrap
    localStoregeMiddleware.ts
    slices/             NEW — all RTK slices, grouped by domain
  templates/      reusable presentational components
  views/          feature-level components and page layouts
```

## Folder responsibilities

**`templates/`** — reusable presentational components used across multiple features.
No business logic, no direct Redux access. Receive everything via props.

**`views/`** — feature-level components responsible for a complete piece of functionality
(e.g. UserList, OrderForm). Connect to Redux, contain business logic,
compose templates/ components.

**`pages/`** — route-level shells. Wire up views, handle route params,
define page layout. Minimal logic — mostly composition.

Rule: templates → views → pages. Never the other way around.
Data flows down, events bubble up.

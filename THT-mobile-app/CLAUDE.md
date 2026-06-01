# CLAUDE.md — Project Guidelines

## Detailed rules

Read the relevant file before writing code:

- Working on any component → [Component structure & code order](.claude/rules/components.md)
- Creating or editing a Redux slice → [Redux slice structure](.claude/rules/slice.md)
- Using or adding a helper/utility → [Helpers reference](.claude/rules/helpers.md)
- Working on API functions → [API layer rules](.claude/rules/api.md)

## Language

- Code, comments, variable names, text in components (placeholder, label, tooltip) — English only

## Stack

- **React Native** 0.81.5 + **Expo** 54 — functional components only, `FC<Props>` typing
- **TypeScript** 5.9.2 — `strict: true`, use `type` not `interface`
- **Redux Toolkit** 2.10.1 — `createSlice`, `createAsyncThunk`, RTK only (no legacy redux)
- **Ant Design React Native** 5.4.3 — UI components with custom theme
- **Expo Router** 6 — file-based routing in `app/` directory
- **Axios** — via `src/api/axios.ts` instance, never import axios directly

## TypeScript conventions

- Always use `type` instead of `interface`
- Prefer explicit return types on hooks and complex functions
- Use `FC<Props>` for components
- Use generic types for reusable patterns
- `LoadStatus = 'loading' | 'loaded' | 'not loaded' | 'error'` is the standard loading state type

## Imports

- Path aliases configured via babel-plugin-module-resolver:
  - `@components` → `src/components`
  - `@screens` → `src/screens`
  - `@icons` → `src/components/icons`
- Order: React → React Native → external packages → Redux → types → helpers → relative components → styles
- Never use relative paths that go up more than 2 levels — use aliases instead

## Component conventions

- Functional components only, no class components
- Props: intersection with `ViewProps` / `TextProps` etc. when wrapping a native element
- Styles: `StyleSheet.create()` for all styles, never inline (except dynamic values)
- No `classnames` — use conditional StyleSheet arrays: `[styles.base, isActive && styles.active]`

## Redux — all new state (RTK only)

All state goes into `src/store/slices/`:

```
store/slices/<domain>/
  slice.ts       — createSlice with reducers and extraReducers
  actions.ts     — createAsyncThunk + runWithAccessData
  selectors.ts   — plain selectors + createSelector for derived state
  types.ts       — domain types
  hooks.ts       — custom hooks that wrap dispatch + selectors
```

- Use `createAsyncThunk` for all async operations
- Always wrap with `runWithAccessData` — see [slice.md](.claude/rules/slice.md)
- Handle pending/fulfilled/rejected in `extraReducers`
- Expose Redux logic through slice-specific custom hooks, not raw dispatch in components
- Use `useAppSelector` and `useAppDispatch` from `src/store/hooks`, never raw `useSelector`/`useDispatch`

## API calls

- Always go through `src/api/axios.ts` (Axios instance with auth interceptors)
- API functions in `src/api/` are pure — they receive `accessData` as explicit parameter
- `runWithAccessData` is called in `actions.ts`, not inside API functions
- Error handling via `handleError` from `src/helpers/errorHandler`

## Ant Design React Native

- Import components from `@ant-design/react-native`: `import { Button, Modal } from '@ant-design/react-native'`
- Theme is configured in `app/_layout.tsx` via `Provider` — use theme tokens, not hardcoded colors
- Do not override styles with inline styles — extend via `style` prop or `StyleSheet`

## Prettier

```
singleQuote: true
tabWidth: 2
trailingComma: 'es5'
printWidth: 80
```

---

## Folder map

```
app/                    Expo Router file-based routes (route shells only)
  _layout.tsx           Root layout: Redux Provider, Ant Design Provider, fonts
  index.tsx             Auth-based redirect logic
  (tabs)/               Tabbed navigation group
  candidate/            Candidate-related routes
  oauth/                OAuth callback

src/
  api/                  HTTP functions by domain (pure, receive accessData)
  components/           Reusable UI components
  constants/            App-wide constants
  contexts/             React contexts
  helpers/              Utility functions, hooks, auth helpers
  hooks/                Shared custom hooks
  screens/              Screen components (business logic, connect to Redux)
  store/
    slices/             RTK slices grouped by domain
    hooks.ts            useAppDispatch / useAppSelector typed hooks
  theme/                Ant Design theming
  types/                Shared TypeScript types
```

## Folder responsibilities

**`src/components/`** — reusable presentational components.
No business logic, no direct Redux access. Receive everything via props.

**`src/screens/`** — feature-level screens responsible for a complete piece of UI.
Connect to Redux, contain business logic, compose components.

**`app/`** — route-level shells only.
Import one screen, handle route params, define layout. Minimal logic.

Rule: components → screens → app routes. Never the other way around.
Data flows down, events bubble up.

# Helpers

`src/helpers/` contains utility functions, the API client, and type helpers.
`src/hooks/` contains custom React hooks.
`src/api/` contains feature-specific API modules.

Before writing a new utility, check here first.

---

## API client

### `helpers/ClientApi.js`

Axios instance with auth headers, device ID, and token management.
This is a **JavaScript file** — do not convert it to TypeScript.

**Always import this, never import `axios` directly:**
```typescript
import ClientApi from '@src/helpers/ClientApi';

const response = await ClientApi.get('/api/company/jobs/application/v2', { params });
const response = await ClientApi.post('/api/...', body);
```

### `helpers/forActions.ts`

Error handling helper:

```typescript
import { handleError } from '@src/helpers/forActions';

try {
  const response = await ClientApi.get('/api/...');
  return response.data;
} catch (error) {
  handleError(error); // shows antd notification with error message
}
```

---

## Feature API modules (`src/api/`)

Feature-specific API functions. Use these instead of calling ClientApi directly in components or actions.

| Module | Purpose |
|--------|---------|
| `applicatonFormApi.ts` | Application form data fetching and submission |
| `pageSettings.ts` | Page-level settings and configuration |
| `redirectUrl.ts` | URL redirect utilities |
| `feedbackPerformanceApi.ts` | Feedback and performance data |
| `internetSpeed.ts` | Internet speed detection |
| `mediaStoreManager.ts` / `mediaStoreManagerAWS.ts` | Media upload management |

---

## Utility modules

### `helpers/storage.ts`

localStorage helpers with JSON serialization:

```typescript
import { getLocalStorage, parseJSON } from '@src/helpers/storage';

getLocalStorage<MyType>('key')   // parses JSON, returns T | null
parseJSON<MyType>(string)        // parses a JSON string, returns T | null
```

Never call `localStorage.getItem` / `JSON.parse` directly — use these helpers.

### `helpers/regexp.tsx`

All project regex patterns — import from here, do not duplicate.

When you need a regex — check `regexp.tsx` first. If it doesn't exist, add it there.

### `helpers/rulesFileds.ts`

Ant Design v3 `Form` validation rule builders — **always use these instead of writing inline rules**.

```typescript
import { emailRules, passwordRules, phoneRules } from '@src/helpers/rulesFileds';

getFieldDecorator('email', { rules: emailRules() })(...)
getFieldDecorator('password', { rules: passwordRules() })(...)
```

Note: the filename has a typo (`rulesFileds`, not `rulesFields`) — use as-is.

When you need form validation — check `rulesFileds.ts` first. If the rule doesn't exist yet, add it there.

### `helpers/date.ts`

Date formatting and timezone utilities. Check here before writing date formatting code.

### `helpers/string.ts`

String and text processing helpers. Check here before writing string manipulation code.

### `helpers/formated.ts`

Formatting utilities (number, currency, display values).

### `helpers/object.ts`

Object manipulation utilities.

### `helpers/list.ts`

List and array utilities.

### `helpers/deviceDetector.tsx`

Device detection helpers (mobile, tablet, desktop).

### `helpers/userCountry.ts`

User country/locale detection utilities.

---

## Hooks (`src/hooks/`)

| Hook | File | Purpose |
|------|------|---------|
| `useAppDispatch` | `hooks/useAppDispatch.ts` | Typed `useDispatch` — always use this, never raw `useDispatch` |
| `useQuery` | `hooks/useQuery.ts` | Parse URL query params |
| `useWindowSize` | `hooks/useWindowSize.ts` | Window width/height |
| `useUserCountry` | `hooks/useUserCountry.ts` | User's geolocation/country |
| `useDomLoaded` | `hooks/useDomLoaded.ts` | DOM readiness detection |
| `useCustomHeaderFooter` | `hooks/useCustomHeaderFooter.ts` | Custom header/footer settings |
| `useTrackCode` | `hooks/useTrackCode.ts` | Tracking/analytics utilities |
| `useRerenderKey` | `hooks/useRerenderKey.ts` | Force re-render key |

---

## Legacy files — do not modify

| Path | Note |
|------|------|
| `helpers/ClientApi.js` | Axios instance — JS file, edit only for auth/header changes |
| `helpers/Utils.js` | Legacy utility collection — do not modify |
| `helpers/componentsWrappers.js` | Legacy component wrappers — do not modify |

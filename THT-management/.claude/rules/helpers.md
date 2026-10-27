# Helpers

`src/helpers/` contains utility functions, the API client, route guards, and type helpers.
`src/hooks/` contains custom React hooks.

Before writing a new utility, check here first.

---

## API client

### `helpers/ClientApi.js`

Axios instance with auth headers, device ID, and build-timestamp tracking.
This is a **JavaScript file** — do not convert it to TypeScript.

**Always import this, never import `axios` directly:**
```typescript
import ClientApi from 'helpers/ClientApi';

const response = await ClientApi.get('/api/management/items', { params });
const response = await ClientApi.post('/api/management/items', body);
```

### `helpers/forActions.ts`

Error handling helpers — same API as THT-myAccount `helpers/forActions.ts`:

| Function | Purpose |
|----------|---------|
| `getErrorMessage(error, fallback?)` | The back end's `data.full_message` or `data.message`, otherwise `fallback` (default *Some error occurred*) |
| `showError(error)` | Ant Design `notification.error` with `getErrorMessage`; no toast for 401 (`response.status` or `response.data.status`) |
| `handleError(error)` | Runs `showError` — the default for `catch` blocks |

```typescript
import { getErrorMessage, handleError } from 'helpers/forActions';

try {
  const response = await ClientApi.get('/api/...');
  return response.data;
} catch (error) {
  handleError(error);
}

dispatch({ type: FAILURE(GET_ITEMS), payload: { error: getErrorMessage(error) } });
```

Never read `error.response.data.data.message` directly (`get(error, 'response.data.data.message')`, optional chaining, local `notifyError`) — the error text for a toast, a redux `FAILURE` payload or inline UI always comes from `getErrorMessage`.

---

## Utility modules

### `helpers/storage.ts`

localStorage helpers with JSON serialization:

```typescript
import { getLocalStorage, parseJSON } from 'helpers/storage';

getLocalStorage<MyType>('key')   // parses JSON, returns T | null
parseJSON<MyType>(string)        // parses a JSON string, returns T | null
```

Never call `localStorage.getItem` / `JSON.parse` directly — use these helpers.

### `helpers/regexp.ts`

All project regex patterns — import from here, do not duplicate:

| Export | Matches |
|--------|---------|
| `passwordRegexp` | Password strength |
| `emailRegex` | Email format |
| `urlRegexp` | URLs |

When you need a regex — check `regexp.ts` first. If it doesn't exist, add it there.

### `helpers/rulesFields.ts`

Ant Design v3 `Form` validation rule builders — **always use these instead of writing inline rules**.

```typescript
import { emailRules, passwordRules, phoneRules } from 'helpers/rulesFields';

getFieldDecorator('email', { rules: emailRules() })(...)
getFieldDecorator('password', { rules: passwordRules() })(...)
```

When you need form validation — check `rulesFields.ts` first. If the rule doesn't exist yet, add it there.

### `helpers/date.ts`

Date formatting utilities for display and storage.

### `helpers/string.ts`

String and text processing helpers. Check here before writing string manipulation code.

### `helpers/number.ts`

Number formatting utilities (currency, percentages, etc.).

### `helpers/validation.ts`

Standalone validation functions (not tied to AntD Form).

### `helpers/mapping.ts`

Data mapping and transformation helpers.

### `helpers/remainders.ts`

Miscellaneous utility functions.

### `helpers/generatePassword.ts`

Password generation utility.

---

## Hooks (`src/hooks/`)

| Hook | File | Purpose |
|------|------|---------|
| `useAppSelector` | `hooks/useAppSelector.ts` | Typed `useSelector` — always use this |
| `useAppDispatch` | `hooks/useAppDispatch.ts` | Typed `useDispatch` — always use this |
| `useQuery` | `hooks/useQuery.ts` | Parse URL query params |
| `useVisible` | `hooks/useVisible.ts` | Toggle visibility state |
| `useBillingServices` | `hooks/useBillingServices.ts` | Current company billing features |
| `useLanguageChange` | `hooks/useLanguageChange.ts` | Language/locale switching |
| `useDisablePreviousDates` | `hooks/useDisablePreviousDates.ts` | AntD DatePicker helper |

For Redux-specific hooks, also check `store/slices/<domain>/hooks/` if one exists.

---

## Legacy files — do not modify

| Path | Note |
|------|------|
| `helpers/authWrapper.js` | Route guards — legacy JS, do not modify |
| `helpers/Utils.js` | Legacy utility collection — do not modify |
| `helpers/componentsWrappers.js` | Legacy component wrappers — do not modify |

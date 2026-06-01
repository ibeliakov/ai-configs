# Helpers

`src/helpers/` contains auth utilities, error handling, storage, and shared hooks.
Before writing a new utility, check here first.

---

## Auth & access

### `accessData.ts`

Injects `company_id` and `company_group_id` into API requests.

**`runWithAccessData(callback, useTempCompanyId?)`** — reads auth context from Redux store (lazy import to avoid circular deps) and passes it to the callback:

```typescript
import { runWithAccessData } from 'helpers/accessData';

const result = await runWithAccessData(async (accessData) => {
  return api.post('/api/endpoint', { ...accessData, someParam });
});
```

- Used **in `actions.ts`**, not inside `src/api/` functions
- Throws if no `company_id` or `company_group_id` is available

**`getAccessDataSync()`** — synchronous version, used in axios interceptor. Do not use in thunks.

**`applyGroupLevelId(accessData)`** — sets `company_id = company_group_id * -1` for group-level API operations.

**`setTempCompanyId(id)` / `clearTempCompanyId()`** — manage temporary company ID in AsyncStorage for group context.

### `tokenManager.ts`

OAuth token refresh and management. The axios interceptor uses it automatically — do not call it manually in components or screens.

---

## Error handling

### `errorHandler.ts`

Centralized error handling. Always call before `rejectWithValue` in thunks:

```typescript
import { handleError } from 'helpers/errorHandler';

try {
  const response = await domainApi.getList(params, accessData);
  return response.data.data;
} catch (error) {
  handleError(error);
  return rejectWithValue(error);
}
```

| Function | Purpose |
|----------|---------|
| `handleError(error)` | Shows `Toast.fail` + handles ACCESS_DENIED (300) result_code |
| `parseApiError(error)` | Returns structured `ApiError` with type and statusCode |
| `getErrorMessage(error)` | Extracts `full_message` → `message` → fallback |
| `shouldShowError(error)` | Returns `false` for 401 errors (handled silently by auto-logout) |
| `showError(error)` | Shows Toast if `shouldShowError` is true |

---

## Storage

### `storage.ts`

AsyncStorage with JSON serialization — never call `AsyncStorage.getItem` / `JSON.parse` directly:

```typescript
import { getStorage, setStorage, removeStorage } from 'helpers/storage';

await setStorage<MyType>('key', value);     // JSON.stringify + AsyncStorage.setItem
const value = await getStorage<MyType>('key'); // AsyncStorage.getItem + JSON.parse, returns T | null
await removeStorage('key');
```

---

## Formatting

### `dateFormat.ts`

Date formatting via dayjs:

```typescript
import { formatDate, formatDateTime } from 'helpers/dateFormat';

formatDate(isoString)      // "Dec 15, 2024"
formatDateTime(isoString)  // "Dec 15, 2024 10:30 AM"
```

### `emailFormatting.ts`

Email content utilities (subject/body preparation for email send flows).

---

## File upload

### `uploadToAWS.ts`

Upload files to AWS S3. Uses `runWithAccessData` internally for auth:

```typescript
import { uploadToAWS } from 'helpers/uploadToAWS';

const url = await uploadToAWS(fileUri, fileName, mimeType);
```

---

## Events

### `eventManager/`

Custom event bus for cross-component communication without Redux:

```typescript
import { eventManager } from 'helpers/eventManager';

eventManager.emit('candidateUpdated', { id: 123 });
eventManager.on('candidateUpdated', handler);
eventManager.off('candidateUpdated', handler);
```

Use only when Redux is overkill (e.g. one-time UI notifications between unrelated components).

---

## WebSocket

### `candidateAppraisalSocket.ts`

STOMP WebSocket connection for real-time candidate appraisal updates.
Managed at app level — do not instantiate manually in components.

---

## Hooks (`src/hooks/`)

Shared custom hooks:

| Hook | Purpose |
|------|---------|
| `useAppSelector` / `useAppDispatch` | Typed Redux hooks — always use these, never raw hooks |
| `useDebounce(value, delay)` | Debounced value |
| `useOAuth` | OAuth authentication flow |
| `useReplaceTokens` | Token refresh helpers |

For slice-specific hooks, check `src/store/slices/<domain>/hooks.ts`.

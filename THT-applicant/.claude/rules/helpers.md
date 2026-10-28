# Helpers

`src/helpers/` contains utility functions, the API client, and type helpers.
`src/hooks/` contains custom React hooks.
`src/api/` contains feature-specific API modules.

Before writing a new utility, check here first.

---

## API client

### `helpers/ClientApi.ts`

Axios instance with auth headers, device ID, and token management (on 401 it refreshes the applicant token once and retries the request).

**Always import this, never import `axios` directly:**
```typescript
import ClientApi from '@src/helpers/ClientApi';

const response = await ClientApi.get<ApiResponse<JobPostApplicationForm>>('/api/company/jobs/application/v2', { params });
const response = await ClientApi.post('/api/...', body);
```

### `helpers/deviceId.ts`

`DEVICE_ID` — value of the `DeviceID` header sent by `ClientApi`. In the browser it is read from `localStorage['DeviceID']`; when missing, a `uuid` v4 is generated and stored there. On the server it is `00000000-0000-0000-0000-000000000000`. Do not change the `'DeviceID'` key.

### `helpers/forActions.ts`

Error helpers. They take `error: unknown` and read the backend envelope (`ApiErrorBody` in `interfaces/commone.d.ts`):

| Function | Purpose |
|----------|---------|
| `getErrorMessage(error, fallback?)` | `data.full_message` → `data.message` → `result_text` (not `failure`/`Success`) → top-level `message` (not on 401/419) → `fallback` (default *Some error occurred*) |
| `getErrorStatus(error)` | HTTP status, or `undefined` without a response |
| `getErrorData(error)` | The error envelope's `data` (`message`, `full_message`, `code`) |
| `handleError(error)` | antd notification with `getErrorMessage` in the browser, no-op on the server. Also on 401/419 — the applicant has no session logout to hide them behind |
| `parseBlobError(error)` | For `responseType: 'blob'` requests: turns a JSON error body back into an object — `throw await parseBlobError(error)` |
| `toLoggableError(error)` | What SSR `console.error` logs: `{ message, code, method, url, status, result_code, error_code }`. Never log the raw AxiosError — `config.headers` holds the API key and `X-Access-Token` |
| `toLoggableHeaders(headers)` | Request headers for SSR logs — only `host`, `referer`, `user-agent`, `accept-language` |
| `isNetworkError(error)` / `isTransientNotNetworkError(error)` | No response at all / proxy 503 or 429 without `result_code` |

```typescript
import { handleError } from '@src/helpers/forActions';

try {
  const response = await ClientApi.get<ApiResponse<Item[]>>('/api/...');
  return response.data.data;
} catch (error) {
  handleError(error);
}
```

Rules:
- Never read `error.response.data…` directly and never show the axios `error.message` — use `getErrorMessage` / `getErrorStatus` / `getErrorData`.
- Request generic is `ApiResponse<T>` from `@src/interfaces/commone` (the backend envelope), never `AxiosResponse<T>`. Endpoints that return a raw body keep their own type.

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
| `deviceTrackingApi.ts` | `trackDeviceEventAPI(goal)` — fire-and-forget GET to the device-tracking endpoint; `goal` is serialised into `request_goal_id` (used for media-access telemetry on the interview page) |

---

## Utility modules

### `helpers/storage.ts`

localStorage helpers with JSON serialization:

```typescript
import { getLocalStorage, getStringLocalStorage, parseJSON } from '@src/helpers/storage';

getLocalStorage<MyType>('key')   // parses JSON, returns T | null
getStringLocalStorage('key')     // raw string, returns string | null
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

- `getCompensation({ min, max, currency })` — `$50,000.00 - $70,000.00`, a single bound, or `Not specified`
- `getLocationShort({ city, state, country })` — `city, state, Country name`

### `helpers/object.ts`

Object manipulation utilities.

### `helpers/list.ts`

List and array utilities.

- `getNameFromListByCode(list, code)` — `name` of the `{ code, name }` item with that code, `''` when not found

### `helpers/deviceDetector.tsx`

Device detection helpers (mobile, tablet, desktop).

`checkIsInAppBrowser()` — true for in-app browsers that usually cannot use the camera (iOS WKWebView without the Safari token, Google app, Facebook/Instagram/LinkedIn/Indeed apps, Android WebView).

### `helpers/mediaAccess.ts`

Camera/microphone access diagnostics shared by the one-way interview page:

```typescript
import {
  classifyMediaAccessError,   // getUserMedia error → MediaAccessStatus
  getMediaPermissionStates,   // Permissions API for camera + microphone, 'unknown' when unsupported
  probeMediaDevice,           // getUserMedia for one kind, stream stopped immediately
  canProbeWithoutPrompt,      // probes are allowed only when they cannot open a new prompt
  stopMediaStream,            // stops every track of a stream
} from '@src/helpers/mediaAccess';
```

`MediaAccessStatus`: `ok | pending | dismissed | blocked_camera | blocked_microphone | blocked_both | system_blocked | no_device | busy | ios_audio_reset | in_app_browser | unsupported`.

### `helpers/clipboard.ts`

`copyToClipboard(text)` — Clipboard API with a `textarea` + `execCommand('copy')` fallback for WebViews; resolves to `true` when copied.

### `helpers/userCountry.ts`

User country/locale detection utilities.

### `helpers/componentsWrappers.tsx`

`ErrorBoundary` — place it in JSX around a UI block. On a render error it shows the "Something went wrong." fallback, calls `reportBoundaryError`, and on `ChunkLoadError` asks the user to reload. Pass `resetKey` (tab, route, step) to clear the error when the key changes.

```tsx
import ErrorBoundary from '@src/helpers/componentsWrappers';

<ErrorBoundary resetKey={activeTab}>...</ErrorBoundary>
```

### `helpers/errorReporting.ts`

`reportBoundaryError(error, info)` — single entry point for errors caught by `ErrorBoundary`. Logs `[ErrorBoundary]` to the console only when `isDebugEnabled()`. Plug an error-monitoring service in here.

### `helpers/debugLogger.ts`

`isDebugEnabled()` — true in development or when `localStorage.debug_logs` is `'true'`. Gate debug-only logging with it instead of leaving `console.log` in code.

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
| `helpers/ClientApi.ts` | Axios instance — edit only for auth/header changes |

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

const response = await ClientApi.get<ApiResponse<Item[]>>('/api/management/items', { params });
const response = await ClientApi.post('/api/management/items', body);
```

Requests to `/api/auth/login` and `/api/auth/login/pin/request` (exact `config.url`) and every request that carries the `MGMT_MCP_REQUEST_HEADER` header (`constants/mgmtMcp.ts`) always go with `Authorization: API_KEY`, even with a session, and are marked `_apiKeyAuth`. A 419 on a marked request is rejected with the original error: no token refresh, no retry, no `forceLogout`. Pass these paths as `url` exactly as written: a full URL or a query string inside `url` does not match.

### `helpers/forActions.ts`

Error handling helpers — same API as THT-myAccount `helpers/forActions.ts`:

| Function | Purpose |
|----------|---------|
| `getErrorMessage(error, fallback?)` | `data.full_message` → `data.message` → `result_text` (not `failure`/`Success`) → top-level `message` (not on 401/419) → `fallback` (default *Some error occurred*) |
| `getVisibleErrorMessage(error, fallback?)` | `''` for 401/419, otherwise `getErrorMessage` — for legacy redux `FAILURE` payloads that containers toast with `error && …` |
| `getErrorStatus(error)` | HTTP status, or `undefined` without a response |
| `getErrorData(error)` | The error envelope's `data` (`message`, `full_message`, `code`, plus `attempts_left`, `retry_after_seconds`, `retry_after_minutes` on login 2FA errors) — for backend codes |
| `showError(error)` | Ant Design `notification.error` with `getErrorMessage`; no toast for 401/419 (`response.status` or `response.data.status`) |
| `handleError(error)` | Runs `showError` — the default for `catch` blocks |

All helpers take `error: unknown`. Types live in `interfaces/common.ts`: `ApiResponse<T>`, `PageData<T>`, `ResponseSearch<T>` (= `ApiResponse<PageData<T>>`), `ApiErrorData`, `ApiErrorBody`, `QueryError`.

```typescript
import { getErrorMessage, handleError } from 'helpers/forActions';

try {
  const response = await ClientApi.get('/api/...');
  return response.data;
} catch (error) {
  handleError(error);
}

dispatch({ type: FAILURE(GET_ITEMS), payload: { error: getVisibleErrorMessage(error) } });
```

Never read `error.response.data.data.message` directly (`get(error, 'response.data.data.message')`, optional chaining, local `notifyError`) — the error text for a toast, a redux `FAILURE` payload or inline UI always comes from `getErrorMessage` / `getVisibleErrorMessage`; the status from `getErrorStatus`.

- Sign-in actions (`authAction.js`) use `getErrorMessage`, not `getVisibleErrorMessage` — there is no session to end silently there.
- RTK thunks reject with a string: `rejectWithValue(getErrorMessage(error))` with `rejectValue: string`, never the raw AxiosError.
- Request generic is `ApiResponse<T>` (the backend envelope), never `AxiosResponse<T>`; endpoints that return a raw body keep their own type.

### `helpers/loginMfa.ts`

Login 2FA (sc-46832), same API as THT-myAccount `helpers/loginMfa.ts`: the code is bound to the `mfa_token` that `/api/auth/login` returns.

| Export | Purpose |
|--------|---------|
| `parseLoginMfaError(error)` | `{ code, message, isSignInLost, retryAfterSeconds }` from a `pin/request` / `pin/verify` error. `isSignInLost` is `true` for `MFA_TOKEN_INVALID` and `LOGIN_PAUSED` (reset `verification_method` and `mfa_token` in the `FAILURE` payload); `message` gets *N attempts left.* appended for `INVALID_PIN` |
| `getResendDelay(sendCount)` | Seconds before the next *Send again*, by the number of codes already sent (the first one comes from `/login`): 30, 30, then 300 |
| `MAX_PIN_SENDS` | 5 codes per sign-in |
| `LOGIN_MFA_ERROR` | The backend codes: `INVALID_PIN`, `LOGIN_PAUSED`, `MFA_TOKEN_INVALID`, `PIN_RESEND_COOLDOWN` |

---

## Connect Claude (Management MCP handoff)

The `/connect-claude` page (sc-47613) signs a user in on behalf of the Claude Desktop extension. The extension opens the app with `?mgmt_mcp_request=<handle>`; the handle goes back to the backend in a header on the login requests, and the backend answers with the loopback callback URL of the extension.

The handle, the `mfa_token` and the callback URL never go into redux, `console.*`, thrown error messages or test snapshots. Never log an axios error of these requests: its `config.headers` holds the handle.

### `constants/mgmtMcp.ts`

| Export | Purpose |
|--------|---------|
| `MGMT_MCP_REQUEST_HEADER` | `X-Management-Mcp-Request` — the header that carries the handle. `ClientApi` sends every request with it under `API_KEY` and does not refresh the session on its 419 |

### `helpers/mgmtMcpHandoff.ts`

The handle arrives in the query of the first URL (`?mgmt_mcp_request=…`). Before the first render `captureMgmtMcpRequest` reads it, tries to store a valid handle as `pending` in tab storage (`sessionStorage`; a blocked storage keeps nothing), then replaces the URL with `PATH_CONNECT_CLAUDE` without the query. `sessionStorage` is the only place on the client where the handle is kept: never put it back into a URL, redux or another storage. It still leaves the page in the `MGMT_MCP_REQUEST_HEADER` header of `postMgmtMcpLogin` and `postMgmtMcpPinVerify`, so the axios error of those requests carries it in `config.headers`.

| Export | Purpose |
|--------|---------|
| `MGMT_MCP_REQUEST_PARAM` | `mgmt_mcp_request` — the query parameter the extension opens the app with |
| `MGMT_MCP_HANDOFF_STORAGE_KEY` | `mgmt_mcp_handoff` — the `sessionStorage` key |
| `MgmtMcpHandoff` | `{ kind: 'pending'; handle }`, `{ kind: 'invalid' }` or `{ kind: 'handed-off' }` |
| `captureMgmtMcpRequest(location?, history?)` | Called once in `src/index.tsx` before the first render. When the URL has `mgmt_mcp_request`, stores `pending` (exactly one value that matches `mgmtMcpRequestRegexp`) or `invalid` (a repeated or malformed value), replaces the URL with `PATH_CONNECT_CLAUDE` (the whole query is dropped) and returns `true`; without the parameter it changes nothing and returns `false` |
| `readMgmtMcpHandoff()` | The stored state, or `null` when nothing valid is stored or storage is unavailable |
| `markMgmtMcpHandedOff()` | Tries to replace the stored state with `handed-off`, which forgets the handle |
| `clearMgmtMcpHandoff()` | Tries to remove the stored state |

Storage errors are swallowed. A failed read returns `null`; a failed write or removal does nothing, so the previously stored state, a `pending` handle included, stays readable.

### `helpers/mgmtMcpCallback.ts`

How a login response ends the handoff.

| Export | Purpose |
|--------|---------|
| `resolveMgmtMcpCompletion(response)` | `MgmtMcpCompletion` from a `/api/auth/login` or `/api/auth/login/pin/verify` body. A non-null `management_mcp_error` wins: `fresh_sign_in_required` → `{ type: 'fresh-sign-in' }`, a known code → `{ type: 'failed', kind }`, any other value → `generic`. Otherwise `management_mcp_redirect` that `parseMgmtMcpCallbackUrl` accepts → `{ type: 'redirect', url }`, a `null` or rejected one → `generic`, a missing key (or no body) → `not-completed` |
| `parseMgmtMcpCallbackUrl(raw)` | `raw` unchanged when it is an `http://127.0.0.1:<1024–65535>/oauth/callback` URL whose query has `code` and `state`, each exactly once with a non-empty value, in either order, and no other parameter; it must also be already in normalized form, with an explicit port, no credentials and no `#`. `null` otherwise, also for a non-string |
| `openMgmtMcpCallback(url)` | `window.location.assign(url)` — the only way to open the callback. Mock it in tests: jsdom does not navigate |
| `MgmtMcpFailureKind` | `invalid-link`, `expired`, `network`, `revoked`, `not-enabled`, `generic`, `not-completed` |
| `MgmtMcpCompletion` | `{ type: 'redirect'; url }`, `{ type: 'fresh-sign-in' }` or `{ type: 'failed'; kind }` |

Backend codes map to kinds: `invalid_grant` → `expired`, `invalid_request` → `invalid-link`, `network_not_allowed` → `network`, `access_revoked` and `invalid_token` → `revoked`, `mcp_not_ready` → `not-enabled`. Branch on `type` and `kind`, never on the backend code.

### `helpers/api/mgmtMcpLogin.ts`

The sign-in requests of the Connect Claude page. `postMgmtMcpLogin` and `postMgmtMcpPinVerify` resolve to the response body; `postMgmtMcpPinResend` resolves to `void`. None of them stores the response: no session is started and nothing from it goes into redux (the build-timestamp dispatch of `ClientApi` on a successful response still runs, as for every request). Errors reject with the axios error; read them with `getErrorMessage` / `parseLoginMfaError`.

| Export | Purpose |
|--------|---------|
| `postMgmtMcpLogin(handle, { email, password })` | `POST /api/auth/login` with `logon_platform: LOGON_PLATFORM` and the handle in `MGMT_MCP_REQUEST_HEADER` |
| `postMgmtMcpPinVerify(handle, mfaToken, pin)` | `POST /api/auth/login/pin/verify` with the handle in `MGMT_MCP_REQUEST_HEADER` |
| `postMgmtMcpPinResend(mfaToken)` | `POST /api/auth/login/pin/request` without the handle; `ClientApi` uses `API_KEY` for it by URL. Resolves to `void`: the body is not returned |
| `MgmtMcpLoginResponse` | `verify`, `verification_method`, `last_phone_digits`, `mfa_token`, plus `management_mcp_redirect` and `management_mcp_error` typed `unknown`: read those two only through `resolveMgmtMcpCompletion` |

---

## Error boundaries

### `helpers/componentsWrappers.tsx`

Default export `ErrorBoundary` — the same class boundary as THT-myAccount and THT-applicant. A crashed subtree is replaced with the secondary *Something went wrong.* text and the error goes to `reportBoundaryError`.

| Prop | Purpose |
|------|---------|
| `resetKey?: string` | Clears the error when the value changes (`pathname` for routes and page content) |

Boundaries live in JSX, never as a HOC in a barrel `index.ts`:
- app root (`src/index.tsx`) and routes (`RouteErrorBoundary` in `pages/Router.js`, `resetKey={pathname}`); `Router` itself must not subscribe to the location, otherwise every route gets a fresh component and the page remounts;
- page content and the sidebar menu inside `views/Manage` — a crashed page keeps the layout;
- every tab of `templates/Tabs` (and of a page-level antd `Tabs`);
- independent self-loading blocks of a page (lists next to the main form) and third-party widgets: Stripe, Quill editors, media and avatar loaders, DnD tables, `ColorPalette`. For a `getFieldDecorator` field wrap the whole `Form.Item`, never the decorated control.

Simple form controls need no boundary of their own.

```typescript
import ErrorBoundary from 'helpers/componentsWrappers';

<ErrorBoundary>
  <QuestionListForInterview />
</ErrorBoundary>
```

### `helpers/errorReporting.ts`

`reportBoundaryError(error, info)` — the single entry point for errors caught by `ErrorBoundary`. It only logs in development for now; an error monitoring service (Sentry or equivalent) plugs in here.

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
| `dateOnlyRegexp` | `YYYY-MM-DD` without time |
| `dateTimeWithOffsetRegexp` | Date-time that ends with `Z` or a `±hh:mm` offset |
| `timeWithoutSecondsRegexp` | `H:mm` / `HH:mm` |
| `mgmtMcpRequestRegexp` | Connect Claude request handle: exactly 43 characters of `A-Z`, `a-z`, `0-9`, `_`, `-` |

When you need a regex — check `regexp.ts` first. If it doesn't exist, add it there.

### `helpers/rulesFields.ts`

Ant Design v3 `Form` validation rule builders — **always use these instead of writing inline rules**.

```typescript
import { emailRules, passwordRules, phoneRules } from 'helpers/rulesFields';

getFieldDecorator('email', { rules: emailRules() })(...)
getFieldDecorator('password', { rules: passwordRules() })(...)
```

When you need form validation — check `rulesFields.ts` first. If the rule doesn't exist yet, add it there.

### `helpers/dayjs.ts`

The configured `dayjs` instance (plugins: `utc`, `timezone`, `customParseFormat`, `localizedFormat`) and the `Dayjs` / `DateInput` types.
Always import dates from here — ESLint blocks `dayjs`, `moment` and `moment-timezone` everywhere else.

```typescript
import dayjs, { Dayjs } from 'helpers/dayjs';
```

`dayjs` is immutable: `d.add(1, 'day')` returns a new object, so always use the result.

### `helpers/date.ts`

Date and time-zone helpers. Server date-times (`LocalDateTime`, no offset) are UTC.

| Export | Purpose |
|--------|---------|
| `parseServerDate(date)` | Server date-time without offset → local `Dayjs` (read as UTC). A date-only value stays on its calendar day; an explicit `Z` / offset is kept |
| `getTimeWithTimeZone(date?)` | `parseServerDate` that returns `undefined` for an empty value — `getTimeWithTimeZone(text)?.format('LL')` in tables |
| `parseServerTime(time)` | Server `LocalTime` (`HH:mm:ss` or `HH:mm`, UTC) → local `Dayjs` for a `TimePicker` |
| `formatServerTime(time)` | Local time → UTC `HH:mm:ss` for the API |
| `getTimeZoneOptions()` | Options for `templates/SelectTimeZone`: `{ label: '(GMT-05:00) US/Eastern', offset, value }`, `US/*` first, then by offset. Built once on first call from `constants/timeZones.ts` (a snapshot of IANA names, kept so saved values like `US/Eastern` stay selectable); zones the browser does not know are skipped |
| `getCurrentTimeZone()` | Browser time zone (`dayjs.tz.guess()`) |

`dayjs().tz(zone)` throws `RangeError` on an unknown zone (moment only warned) — guard zones that come from data.

### `helpers/momentAdapter.ts`

`toMoment(dayjs)` / `fromMoment(moment)` (through `.toDate()`). The only file allowed to import `moment` — used by `templates/DatePicker` because antd 3 pickers require moment objects. Do not use it elsewhere; it is deleted with the antd upgrade (sc-40207).

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

### `helpers/singleFlight.ts`

`singleFlight(slot, task)` keeps one request in flight per slot (a `useRef<Promise<T> | null>(null)` or any `{ current }` object). While `slot.current` holds a promise, it returns that promise and does not call `task`, so a double click or a repeated submit sends one request. Otherwise it starts `task()` and stores its promise in the slot. The slot is cleared when that promise resolves or rejects, so the next call starts a new request.

```typescript
import { singleFlight } from 'helpers/singleFlight';

const requestRef = useRef<Promise<void> | null>(null);

const onSubmit = (values: Values) => singleFlight(requestRef, () => saveItem(values));
```

To let the next call start at once (for example when the user leaves a step), set `slot.current = null`. The older request is not cancelled; when it settles, it does not clear a newer promise in the slot. Ignoring the older response is the caller's job: `views/ConnectClaude/hooks/useConnectClaude.ts` checks a step version before it applies one. Use this helper instead of writing an in-flight ref check in a component or hook.

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
| `useResendCooldown` | `hooks/useResendCooldown.ts` | *Send again* lock counted from an absolute deadline: `{ isCoolingDown, secondsLeft, start(seconds?), reset }` |
| `useDisablePreviousDates` | `hooks/useDisablePreviousDates.ts` | `disabledDate` for `templates/DatePicker`: `(current: Dayjs) => boolean` that blocks days before today (or before the given `Dayjs`) |

For Redux-specific hooks, also check `store/slices/<domain>/hooks/` if one exists.

---

## Legacy files — do not modify

| Path | Note |
|------|------|
| `helpers/authWrapper.js` | Route guards — legacy JS, do not modify |
| `helpers/Utils.js` | Legacy utility collection — do not modify. Its old `Utils.date` helpers moved to `helpers/date.ts` (sc-40217) |

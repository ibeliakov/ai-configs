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

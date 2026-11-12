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
| `assessmentSittingApi.ts` | Monitored assessment sitting (THT-docs `docs/api/assessment-monitoring.md` §6): `openSittingAPI`, `verifyTurnstileAPI`, `setupSittingAPI`, `newPairingCodeAPI`, `heartbeatSittingAPI`, `sendSittingEventsAPI`, `uploadSittingSnapshotAPI` (multipart with an explicit `multipart/form-data` header), `closeSittingAPI`; `closeSittingOnUnloadAPI` and `sendSittingEventsOnUnloadAPI` for a hidden page or `pagehide` (keepalive `fetch`, `sendBeacon` fallback) |
| `assessmentPairingApi.ts` | Paired-phone page (same contract, §8): `checkPairingCodeAPI`, `claimPairingCodeAPI`, `phoneHeartbeatAPI`, `phoneContinueAPI`; `phoneHeartbeatOnHideAPI` sends `visible: false` on hide / `pagehide` the same unload-safe way |

Requests from the browser go through the same-origin proxy `pages/api/[...all].ts`, so a relative `/api/...` URL also works for `navigator.sendBeacon`.

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

Never call `localStorage.getItem` / `JSON.parse` directly — use these helpers. To write a string to localStorage use `setStringLocalStorage(key, value)`.

sessionStorage has the same readers (`getSessionStorage<T>`, `getStringSessionStorage`) plus `setStringSessionStorage(key, value)` and `removeSessionStorage(key)`.

### `helpers/safeStorage.ts`

`safeStorageCall(action, fallback)` — runs a storage call and returns `fallback` (with a `console.warn`) when the browser throws: blocked site data, private mode, quota. Wrap storage access that must never break a flow:

```typescript
import { safeStorageCall } from '@src/helpers/safeStorage';

safeStorageCall(() => getStringSessionStorage(key), null);
```

### `helpers/sittingToken.ts` / `helpers/phoneSession.ts`

Assessment monitoring state kept in sessionStorage through `safeStorageCall`:

- `getStoredSittingToken` / `storeSittingToken` / `clearStoredSittingToken(assignmentId)` — the last sitting token per assignment, sent back as `previous_sitting_token` after a reload
- `getStoredPhoneSession` / `storePhoneSession` / `clearStoredPhoneSession(code)` — the paired phone's `phone_token` and page info per pairing code, so a reload does not claim the code again

### `helpers/sittingItemTime.ts`

Per-question time a monitored sitting reports on `answer` as `paused_ms` / `away_ms`: `startItemTime(itemKey)` when a question is shown (no-op for the same key), `setItemTimeMode('active' | 'paused' | 'away')` (pause wins over away), `readItemTime()` returns both totals up to now, `resetItemTime()`.

### `helpers/snapshot.ts`

`captureSnapshot(stream, { width, maxBytes })` — grabs one frame of a live video stream through a hidden `<video>`, scales it down to `width` (never up) and encodes JPEG at falling quality until it fits `maxBytes`; `null` when the track is not live or nothing fits.

### `helpers/sittingMedia.ts`

Registry of the media streams a sitting keeps open: `setSittingStream('camera' | 'screen', stream | null)` (stops the stream it replaces), `getSittingStream(kind)`, `stopSittingStreams()`.

### `helpers/turnstile.ts`

`loadTurnstile(timeoutMs)` — injects the Cloudflare Turnstile script once (`render=explicit`) and resolves `window.turnstile`; rejects on load error or timeout so the caller can report `turnstile_unavailable`. A later call after a rejection tries again. Typings for `window.turnstile` live in `decs.d.ts`.

`isTurnstileRequired(plan)` — the sitting's `monitoring.turnstile_check` is `true`: a check that can't run blocks setup instead of passing. For the widget itself use `hooks/useTurnstileWidget`.

### `helpers/displayCount.ts` / `helpers/screenShare.ts`

- `getDisplayCount()` — `1` when `screen.isExtended` is `false`, otherwise `getScreenDetails().screens.length`, never below `2` while `screen.isExtended` is `true` (so it agrees with `hasExtraDisplay()`); `null` when the browser cannot tell
- `hasExtraDisplay()` — `screen.isExtended === true`, without the `getScreenDetails` permission prompt
- `watchDisplays(onChange, pollMs)` — calls `onChange(extended)` now, every `pollMs` and on the `screen` `change` event; returns the unsubscribe function; a no-op where `screen.isExtended` isn't available
- `canConfirmEntireScreen()` — the browser supports the `displaySurface` constraint, so an entire-screen share can be verified
- `requestScreenShare()` — `getDisplayMedia` asking for the entire screen; returns the stream and `entire_screen | window | tab | null` from the track's `displaySurface`
- `isUserCancelled(error)` — the candidate closed the browser's share picker

### `helpers/regexp.tsx`

All project regex patterns — import from here, do not duplicate.

When you need a regex — check `regexp.tsx` first. If it doesn't exist, add it there.

Date patterns: `dateOnlyRegexp` (`YYYY-MM-DD` without time), `dateTimeWithOffsetRegexp` (date-time ending with `Z` or a `±hh:mm` offset).

`htmlTagRegexp` — one HTML tag, `/<[^>]*>/g`, the same pattern as the backend `removeHtmlTags`. It is global, so use it with `replace`, not `test`; for stripping go through `stripHtmlTags` in `string.ts`.

### `helpers/rulesFileds.ts`

Ant Design v3 `Form` validation rule builders — **always use these instead of writing inline rules**.

```typescript
import { emailRules, passwordRules, phoneRules } from '@src/helpers/rulesFileds';

getFieldDecorator('email', { rules: emailRules() })(...)
getFieldDecorator('password', { rules: passwordRules() })(...)
```

Note: the filename has a typo (`rulesFileds`, not `rulesFields`) — use as-is.

When you need form validation — check `rulesFileds.ts` first. If the rule doesn't exist yet, add it there.

### `helpers/dayjs.ts`

The configured `dayjs` instance (plugins: `utc`, `timezone`, `customParseFormat`, `advancedFormat`) and the `Dayjs` / `DateInput` types.
Always import dates from here — ESLint blocks `dayjs`, `moment` and `moment-timezone` everywhere else.

```typescript
import dayjs, { Dayjs } from '@src/helpers/dayjs';
```

`dayjs` is immutable: `d.add(1, 'month')` returns a new object, so always use the result (`onChange(value.add(1, 'month').date(1))`).

### `helpers/date.ts`

Date formatting and time-zone utilities. Check here before writing date formatting code. Server date-times (`LocalDateTime`, no offset) are UTC.

| Export | Purpose |
|--------|---------|
| `parseServerDate(date)` | Server date-time without offset → local `Dayjs` (read as UTC). A date-only value stays on its calendar day; an explicit `Z` / offset is kept |
| `getTimeWithTimeZone(date?)` | `parseServerDate` that returns `undefined` for an empty value |
| `getFormattedDate` / `getFormattedTime` / `getFormattedDateWithTime` | `getTimeWithTimeZone` formatted with `FORMATE_DATE` / `FORMATE_TIME` / `FORMATE_DATE_WITH_TIME` |
| `parseCalendarDate(date)` | Calendar part of a `YYYY[-MM[-DD]]` value (time and offset ignored) — resume job history dates, which can be partial |
| `toTimeZone(date, timeZone?)` | UTC date-time shown in `timeZone`; an empty or unknown zone falls back to the browser zone instead of throwing |
| `getStrTimeZone(timeZone?)` | `(GMT+01:00) Europe/Berlin` label (sent to the backend as `time_zone`) |
| `getCurrentTimeZone()` / `isValidTimeZone(zone)` | Browser zone (`dayjs.tz.guess()`); whether `Intl` knows the zone |

`dayjs().tz(zone)` throws `RangeError` on an unknown zone — during SSR that crashes the page, so zones that come from data go through `toTimeZone`.

Never call `.tz()` directly — go through `toTimeZone`. dayjs `.tz()` parses the target wall clock as browser-local time, so a wall-clock time inside the browser's own spring-forward hour moves by an hour, instant included. The helpers compute the offset with `Intl` and pin the wall-clock fields: the result is exact for formatting (`z` included), comparisons and `valueOf()`. Date maths chained on such a value (`.add()`, `.startOf()`) is rebuilt by dayjs from browser-local time and can still shift inside that hour — do the maths on the instant (or in UTC) and convert last. The helpers write dayjs private fields, which is why `dayjs` is pinned to an exact version: check `toTimeZone` on a DST-gap night of the browser zone when upgrading it (the myAccount copy has tests).

### `helpers/momentAdapter.ts`

`toMoment` / `fromMoment` and `toMomentRange` / `fromMomentRange` (through `.toDate()`; `moment(dayjsObject)` would silently return now). The only file allowed to import `moment` — used by `templates/DatePicker` because antd 3 pickers require moment objects. Do not use it elsewhere; it is deleted with the antd upgrade.

### `helpers/string.ts`

String and text processing helpers. Check here before writing string manipulation code.

| Export | Purpose |
|--------|---------|
| `stripHtmlTags(html)` | Removes tags with `htmlTagRegexp`; entities (`&nbsp;`, `&amp;`) stay as they are, like on the backend. `''` for an empty value |
| `hasIndexableDescription(html)` | The backend rule for a job description: the plain text after `stripHtmlTags` is longer than 100 characters. Below that the job is left out of the career page, the sitemap and the job board feeds, and `JobDetailsHelmet` marks its page `noindex` without JSON-LD |
| `getEmploymentTypeEnum(code)` | Employment type code → schema.org `employmentType` (`FULL_TIME`, …); `OTHER` for an unknown code, `undefined` for an empty one |
| `getSalaryUnitText(interval)` | `compensation_interval` → JobPosting `baseSalary` `unitText`: `annually` → `YEAR`, `monthly` → `MONTH`, `weekly` → `WEEK`, `daily` → `DAY`, `hourly` → `HOUR`; `undefined` (the key is dropped from the JSON-LD) for an unknown or empty value |

### `helpers/formated.ts`

Formatting utilities (number, currency, display values).

- `getCompensation({ min, max, currency })` — `$50,000.00 - $70,000.00`, a single bound, or `Not specified`
- `getLocationShort({ city, state, country })` — `city, state, Country name`

### `helpers/object.ts`

Object manipulation utilities.

### `helpers/list.ts`

List and array utilities.

- `getNameFromListByCode(list, code)` — `name` of the `{ code, name }` item with that code, `''` when not found
- `toggleExclusiveSelection(selected, value, exclusive)` — multi-select toggle where the `exclusive` values clear every other choice and are cleared by any other choice (assessment `mutual_exclusive` answers, the survey's veteran `NOT_APPLICABLE`)

### `helpers/deviceDetector.tsx`

Device detection helpers (mobile, tablet, desktop).

`checkIsInAppBrowser()` — true for in-app browsers that usually cannot use the camera (iOS WKWebView without the Safari token, Google app, Facebook/Instagram/LinkedIn/Indeed apps, Android WebView). The user-agent patterns live in `helpers/inAppBrowser.ts` (`isInAppUserAgent(userAgent)`), which does not load `device-detector-js`; use it where the parser must not load, such as code that runs on every page.

Assessment sitting device report: `getSittingDeviceType()` (`computer | phone | tablet`; an iPad presenting as a Mac with touch counts as `tablet`), `getSittingDeviceInfo()` (user agent, screen size, touch), `getSittingCapabilities()` (camera, screen share, display count, wake lock).

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

### `helpers/mediaAccessGuide.ts`

`getMediaAccessGuide(status, cameraOnly?)` — the troubleshooting copy for a `MediaAccessStatus`: `{ title, steps, recheckLabel?, reload?, copyLink? }` with steps for the detected browser and OS, `null` for `ok` / `pending`. Shared by `templates/MediaAccessProblem` (one-way interview) and the assessment camera step (`templates/TroubleshootGuide`).

### `helpers/clipboard.ts`

`copyToClipboard(text)` — Clipboard API with a `textarea` + `execCommand('copy')` fallback for WebViews; resolves to `true` when copied.

### `helpers/userCountry.ts`

User country/locale detection utilities.

### `helpers/componentsWrappers.tsx`

`ErrorBoundary` — place it in JSX around a UI block. On a render error it shows the "Something went wrong." fallback, reports through `reportBoundaryError`, and on `ChunkLoadError` asks the user to reload. Pass `resetKey` (tab, route, step): the error clears when the key changes after an error was caught. `pages/_app.tsx` wraps the whole app with `resetKey={router.asPath}`.

```tsx
import ErrorBoundary from '@src/helpers/componentsWrappers';

<ErrorBoundary resetKey={activeTab}>...</ErrorBoundary>
```

### `helpers/monitoring/`

Error monitoring behind a vendor-neutral facade; Sentry (`@sentry/nextjs`) is the first provider (sc-46855). Errors only: no tracing, no session replay. Without `NEXT_PUBLIC_SENTRY_DSN` at build time (and `SENTRY_DSN` on the server) no Sentry provider is registered. The layer keeps its state on `globalThis.__thtMonitoring`, because `instrumentation.ts` is bundled separately from the pages. Full description: THT-docs `docs/monitoring/sentry-frontend.md`.

Import from `@src/helpers/monitoring` only; `@sentry/*` is an ESLint error outside `helpers/monitoring/providers/`. Initialisation lives in `instrumentation.ts` (server) and `instrumentation-client.ts` (browser); do not initialise anywhere else.

| Export | Purpose |
|--------|---------|
| `reportServerError(error, context)` | In every `getServerSideProps` `catch`, before returning `hasError`; skips API 4xx and `ExpectedError` |
| `ExpectedError` | Throw it for an intentional SSR failure (invalid id, paused job post, no data) so it is not reported |
| `reportError(error, context?)` | A caught client failure that is a real error (upload, media recorder). The client drops API 4xx and network, timeout and cancel errors on its own |
| `addMonitoringBreadcrumb({ category, message, data? })` | Expected states that explain a later error (camera denied, no device, device busy) — breadcrumbs, not events |
| `reportErrorPage(context)` | `pages/_error.tsx` only |
| `reportBoundaryError` | Called by `ErrorBoundary` only |
| `setMonitoringUser`, `clearMonitoringUser` | `initClientMonitoring` sets the device id and the `in_app_browser` tag; do not call them from features |
| `CUSTOM_LAYOUT_SCRIPT_URL` | The name given to scripts injected from a company's custom header and footer (`useCustomHeaderFooter`), so their errors are filtered out |

Rules:
- Candidate links are credentials: never put a hash, token, `candidate_url_query_string`, email or file name into `tags`, `extra` or messages. `monitoring/scrub.ts` is a safety net, not permission.
- Do not report expected candidate states (camera permission, validation, an invalid or expired link): use a breadcrumb or nothing.
- A new SSR page calls `reportServerError(error, context)` in its `catch`; intentional throws use `ExpectedError`.
- A new provider is a file in `providers/` plus a line in `client.ts` or `server.ts`; application code does not change.

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
| `useTextSize` | `hooks/useTextSize.ts` | Candidate text size (`normal`, `larger`, `largest`) stored in `localStorage['candidate_text_size']`; used by `templates/CandidateFlowLayout` |
| `useCopyLink` | `hooks/useCopyLink.ts` | Copies the current page link: `{ copied, copyLink }`, `copied` resets after 2 s |
| `useTurnstileWidget` | `hooks/useTurnstileWidget.ts` | Cloudflare Turnstile widget in a container ref: `{ status: 'loading' \| 'ready' \| 'unavailable', retry }`; calls `onToken(token)` and `onUnavailable()` (no site key, script load error or timeout, widget error, unsupported browser); `retry` resets the widget or reloads the script when it never loaded. Used by the assessment setup and the paired phone page |

---

## Legacy files — do not modify

| Path | Note |
|------|------|
| `helpers/ClientApi.ts` | Axios instance — edit only for auth/header changes |

# Helpers

`src/helpers/` contains pure utility functions, the API client, route guards, and custom hooks.
Before writing a new utility, check here first.

---

## Utility modules

### `string.ts`
String and HTML processing. Most-used functions:

| Function | Purpose |
|----------|---------|
| `getShortText(text, maxLen)` | Truncate with ellipsis |
| `removeHtmlTags(html)` | Strip HTML to plain text |
| `encodeTextFromQuillInput(html)` | Quill rich text → plain text |
| `addStylesToEmailMessage(html)` | Add inline CSS to email images/paragraphs |
| `convertToSMS(html)` | Strip HTML for SMS |
| `convertToEmailBody(html)` | Prepare HTML for email body with styles |
| `convertToEmailBodyWithSignature(html, sig)` | Append signature |
| `convertToEmailSubject(text)` | Prepare plain text for email subject |
| `generateApplicationFormLink(...)` | Build applicant portal URL |
| `getCompensation(min, max, currency)` | Format salary range string |
| `addComas(number)` | Format number with thousands separators |
| `convertCompanyNameToSubDomain(name)` | Clean name for subdomain use |
| `nocacheUrl(url)` | Add cache-busting `?t=` param |
| `toHHMMSS(seconds)` | Format seconds as HH:MM:SS |
| `toComparablePhone(phone)` | Digits-only key for comparing phone numbers in any format; a ten-digit number gets the US `1` (the back end's suppression canonicalisation) |
| `toComparableEmail(email)` | Trimmed, lower-cased key for comparing email addresses the way the back end does |
| `isRichTextEmpty(html)` | `true` for a missing value or editor markup with no visible text and no image, iframe or video (`<p><br></p>`, `<p>&nbsp;</p>`); the one emptiness check for Quill values |
| `convertTextToNote(text, users)` | `AddNote` field text → the note that is sent: trimmed, `@full name email` mentions and `(::start old::)` mentions of former users turned into `<span data-id="ID">Name</span>`; the inverse of `convertNoteToText`. Measure note length on its result |

### `text.ts`
Clipboard:

| Function | Purpose |
|----------|---------|
| `copyTextToBuffer(text, message?)` | Copy to the clipboard and show a success toast (default *Copied*) |
| `writeTextToClipboard(text)` | Copy to the clipboard without a toast — for controls that confirm the copy in place (a Copy → Copied tooltip). Rejects when the browser refuses clipboard access; the caller shows the error |

### `codeInput.ts`
Cell logic of `templates/CodeInput` (the six-cell PIN field of the 2FA and guest code screens). All three return a new array and leave the input untouched:

| Function | Purpose |
|----------|---------|
| `keepDigits(value)` | Only the digits of a typed, pasted or autofilled value (`'123 456'` → `'123456'`) |
| `fillCodeCells(cells, startIndex, chars)` | Put `chars` into the cells from `startIndex` to the right; what does not fit after the last cell is dropped |
| `clearCodeCell(cells, index)` | Empty one cell (Backspace) |

### `dayjs.ts`
The configured `dayjs` instance (plugins: `utc`, `timezone`, `customParseFormat`, `advancedFormat`, `isSameOrBefore`, `isSameOrAfter`) and the `Dayjs` / `DateInput` types. Always import dates from here — ESLint blocks `dayjs`, `moment` and `moment-timezone` everywhere else (moment was removed in sc-40180).

```typescript
import dayjs, { Dayjs } from 'helpers/dayjs';
```

`dayjs` is immutable: `d.add(1, 'day')` returns a new object, so always use the result. There is no object form of `.set({...})` and no plural getters (`.hours()`) — use `.hour(h).minute(m)` / `.hour()`.

### `date.ts`
Date formatting and time zones. Server date-times (`LocalDateTime`, no offset) are UTC.

| Function | Purpose |
|----------|---------|
| `getTimeWithTimeZone(date)` | Server value → local `Dayjs`: no offset = UTC, an explicit `Z` / offset is kept, a date-only value stays on its day (parsed strictly — `2024-02-30` is invalid). Non-string input is passed through `dayjs()`. Used by the date-format hooks |
| `parseServerDate(date)` | The string part of `getTimeWithTimeZone` |
| `getMonthDayYearFormatted(date)` | Format to "MMM DD, YYYY" |
| `getFormattedDateDB(date)` | Format for DB storage (`YYYY-MM-DD`) |
| `parseDateAnswer(value)` | A free-text answer (screening questions) → local `Dayjs` when it is exactly `YYYY-MM-DD` (same calendar day, impossible dates rejected) or a full ISO timestamp; `undefined` for anything else. Pass the result to `useDateFormat`'s `getFormattedDate` and fall back to the raw answer |
| `convertUtcToLocalDate(utc)` | Convert UTC → user's local timezone |
| `toTimeZone(date, tz)` | UTC instant shown in `tz` (exact even on DST nights — see below); an empty or unknown zone falls back to the browser zone instead of throwing |
| `parseInTimeZone(value, tz)` | Replacement for `moment.tz(value, tz)`: an ISO string with `Z` / offset is converted to `tz`, a plain string is read as wall-clock time in `tz` |
| `formatUtcInTimeZone(utc, tz, format)` | Format UTC in a specific timezone (local when the zone is unknown). `z` prints Intl short names (`CST`, `GMT+2`) |
| `isValidTimeZone(tz)` | Whether `Intl` knows the zone — `dayjs().tz(zone)` throws `RangeError` on an unknown one |
| `getStrTimeZone(tz)` | Timezone string with UTC offset, e.g. `(GMT-06:00) America/Chicago` |
| `getTimeZoneOptions()` | Options for `templates/SelectTImeZone` and the Sequences forms: `{ label, offset, value }` sorted by real offset (half-hour zones included). Built once on first call from `constants/timeZones.ts` (a snapshot of IANA names, kept so `US/*` and values saved on the backend stay selectable) |
| `getCurrentTimeZone()` | User's current timezone (`dayjs.tz.guess()`) |
| `getMeetingDateFormatted(date)` | Meeting-specific display format |
| `getTimePeriod(from, to)` | Human-readable date range |
| `getActiveDays(start, end)` | Days between activation and archival |
| `disabledPastDate` / `disabledPastDateAndCurrent` | `disabledDate` helpers for `templates/DatePicker` (`Dayjs`) |

Never call `.tz()` directly — go through `toTimeZone` / `parseInTimeZone` / `formatUtcInTimeZone`. dayjs `.tz()` parses the target wall clock as browser-local time, so a wall-clock time inside the browser's own spring-forward hour moves by an hour, instant included. The helpers compute the offset with `Intl` and pin the wall-clock fields: the result is exact for formatting (`z` included), comparisons and `valueOf()`. Date maths chained on such a value (`.add()`, `.startOf()`) is rebuilt by dayjs from browser-local time and can still shift inside that hour — do the maths on the instant (or in UTC) and convert last. The helpers write dayjs private fields, which is why `dayjs` is pinned to an exact version: re-run the DST gap tests in `helpers/date.test.ts` when upgrading it.
| `getTodayInUsCentral()` | Today's calendar date in `America/Chicago` as a local `Dayjs` — every Indeed campaign date is US Central |

### `time.ts`
UTC↔local conversion for scheduling:

| Function | Purpose |
|----------|---------|
| `timeToMinutes(time)` | "HH:MM" → minutes from midnight |
| `minutesToTimeValue(minutes)` | Minutes from midnight → "HH:MM:SS" (inverse of `timeToMinutes`) |
| `formatClockDuration(seconds)` | Seconds → stopwatch text "0:35", "12:05", "1:02:09" (rounds, clamps negatives to 0); for short durations such as monitoring flags. For "14 min" / "1 hr 5 min" use `formatDuration(minutes)` from `recurrence.ts` |
| `parseTimeOfDay(time)` | `HH:mm:ss` or `HH:mm` → `Dayjs` today (dayjs with `'HH:mm:ss'` alone rejects `HH:mm`) |
| `parseDateTimeInTimeZone(date, time, tz)` | Replacement for `moment.tz(str, fmt, tz)` / object input: wall-clock date + time in `tz`; on the fall-back night it takes the earlier of the two times, like moment; unknown zone → UTC |
| `parseTimeOfDayInTimeZone(time, tz)` | `parseDateTimeInTimeZone` on the current UTC date |
| `utcSlotToLocal(date, time, tz)` | UTC time slot → `tz` (via `toTimeZone`; `24:00:00` rolls to the next midnight) |
| `convertFreeRangesToTimezone(ranges, tz)` | Convert availability ranges, handles cross-midnight splits |

### `availability.ts`
Weekly availability (`DayAvailabilityAPI[]`) shared by General settings, scheduling links and templates:

| Export | Purpose |
|--------|---------|
| `DAYS_OF_WEEK`, `DAY_LABELS`, `DAY_NAMES` | Mon→Sun order, short ("Mon") and full ("Monday") labels |
| `DEFAULT_TIME_SLOT`, `INITIAL_AVAILABILITY` | 09:00–16:30, Mon–Fri enabled |
| `formatTimeSlot(slot)` | `"9:00 AM–4:30 PM"` for display |
| `normalizeAvailability(days)` | Always 7 days, missing `time_slots` → `[]`, slots sorted — run before sending to the API |
| `stripTimeSlotIds(days)` | Drop slot ids before PUT |

The editor UI lives in `views/AvailabilityEditor` (mount inside any AntD `Form`, `name` prop = field path); validation rules are `getTimeSlotStartRules` / `timeSlotEndRules` / `timeSlotOverlapRule` in `rulesFields.ts`.

### `regexp.ts`
All project regex patterns — import from here, do not duplicate:

| Export | Matches |
|--------|---------|
| `passwordRegexp` | 8–30 chars, uppercase, number, special char |
| `emailRegex` | Email format |
| `urlRegexp`, `urlRegexpHttp` | URLs (with/without protocol) |
| `postlaCodeRegexp` | US postal codes |
| `dateOnlyRegexp` | `YYYY-MM-DD` without time |
| `dateTimeWithOffsetRegexp` | Date-time ending with `Z` or a `±hh:mm` offset |
| `emptyHtmlRegexp` | Empty HTML tags/paragraphs |
| `imageRegexp` | Image file URLs |
| `currencySymbolPayRegex` | "$50,000/year" patterns |
| `currencyCodePayRegex` | "USD 50000 annually" patterns |
| `salaryKeywordPayRegex` | "Salary: $120,000" patterns |
| `salaryKeywordWithPeriodPayRegex` | "Rate: 48.37 per hour" patterns |
| `dataImageUriRegexp` | An embedded `data:image/…` src anywhere in editor HTML (stateless, no `g`) |
| `dataUriRegexp` | Mime type and base64 payload of one `data:` URI |

### `rulesFields.ts`
AntD `Form` validation rule builders — **always use these instead of writing inline rules**.

Usage pattern:
```typescript
import { emailRules, passwordRules, phoneRules, urlWithProtocolRules } from 'helpers/rulesFields';

<Form.Item name="email" rules={emailRules()}>
<Form.Item name="password" rules={passwordRules()}>
<Form.Item name="phone" rules={phoneRules()}>
```

Contains rule builders for: email, password, phone, URL, postal code, company name (async uniqueness check), subdomain (async uniqueness check), LinkedIn ID, job description, screening questions, SMS templates, template tokens, benefits, status names, Indeed campaign budget (`indeedBudgetRules`) and restart dates (`getIndeedRestartStartDateRules`, `getIndeedRestartEndDateRules`), Resume Scoring Criteria (`resumeScoringJobDescriptionRules` — required, no length cap; `scoringInstructionsRules(required)` — 10 000 characters of the HTML that is sent, as the back end counts; `resumeScoringTemplateTitleRules(label)` — required, 255), note length (`noteLengthRule(max, toNote)` — `toNote(value).length` in UTF-16 units, as Java `@Size` counts, an emoji is 2; `NOTE_MAX_LENGTH` 2 500 for scorecard, interview-question and employee notes, `CANDIDATE_NOTE_MAX_LENGTH` 5 000 for candidate notes, `NOTE_COUNTER_THRESHOLD_RATIO` 0.8 for the `AddNote` counter).

`jobDescriptionRules(label)` also rejects a description that still contains a `data:image` embed, on submit only (`imageUploadPendingMessage`) — the editor's `useImageAutoUpload` normally replaces such embeds before the user can save.

When you need form validation — check `rulesFields.ts` first. If the rule doesn't exist yet, add it there.

### `schedulingLinkFields.ts`
Shared by the scheduling link editor and the scheduling-link template editor, so both treat rich text and failed saves the same way:

| Function | Purpose |
|----------|---------|
| `richTextToPayload(value)` / `plainTextToPayload(value)` | Quill HTML with token chips → the string the back end stores (styled email HTML / plain text) |
| `interviewDetailsToPayload(details)` / `interviewDetailsToForm(details)` | Round-trip of `location_value`, `interview_name`, `interview_description` between the API and the form |
| `interviewDetailsWithoutRichText(details)` | First-pass form values with the rich-text fields blanked, so Quill mounting does not mark the form dirty |
| `scrollToFirstFormError(form, error)` | Smooth scroll to the first field of an AntD `validateFields` rejection |
| `handleSchedulingSaveError(form, error)` | The `catch` of an editor's Save: validation errors → toast *Please fix the highlighted fields before saving.* and a scroll on the next tick (after collapsed blocks expand); a superseded validation (`errorFields: []`) → nothing; an axios error → nothing (`handleError` already toasted); anything else → toast *Couldn't save your changes. Please try again.* |

Never leave the `catch` of a form Save empty or scroll-only: a Save that ends without a request must always tell the user why. To open a collapsed block that holds an invalid field, render `templates/FormErrorWatcher` (`names`, `onError`) inside the form.

### `image.ts`
Images that go through the rich-text editor (`templates/EmailEditor`):

| Function | Purpose |
|----------|---------|
| `getImageFileErrors(file)` | Format (`IMAGE_FORMAT_LIST`) and size (`IMAGE_MAX_SIZE_MB` = 5) errors for an editor image, `[]` when allowed; the one check for the Image button and for pasted or dropped files |
| `dataUriToFile(dataUri, name?)` | A base64 `data:` URI → `File` (mime kept, generated `image-<ts>.<ext>` name), `null` when it is not base64 |

### `storage.ts`
localStorage / sessionStorage with JSON serialization:

```typescript
import { getLocalStorage, getSessionStorage } from 'helpers/storage';
import { getStringLocalStorage } from 'helpers/storage'; // raw string, no JSON parse

getLocalStorage<MyType>('key')       // parses JSON, returns T | null
getSessionStorage<MyType>('key')     // same for sessionStorage
getStringLocalStorage('key')         // raw string value
```

Never call `localStorage.getItem` / `JSON.parse` directly — use these helpers.

### `candidates.ts`
Candidate utilities:

| Function | Purpose |
|----------|---------|
| `sortByPriority(a, b)` | Sort emails/phones so the primary one comes first |
| `getSmsConsentBlock(status, isA2PRegistrationFinished, isTwilioSuppressed?)` | Why SMS is blocked for a candidate, or `null` when texting is allowed. Twilio suppression wins over every status; `OPTED_OUT` always blocks; `DECLINED` blocks but allows recording consent (`canRequestConsent`); `PENDING` blocks only for A2P-registered companies |
| `getSmsConsentBlockedCandidates(candidates, isA2PRegistrationFinished)` | Same rule applied to a list — used by bulk SMS/sequence widgets |
| `getSmsSendRefusal(error)` | Maps a **400** from the SMS send endpoint with a consent token in `data.message` (`twilio_suppressed`, `opted_out`, `sms_declined`, `sms_consent_pending`) to the same `SmsConsentBlock` as `getSmsConsentBlock`; `null` for any other error. Use it instead of showing the raw token |
| `isTwilioSuppressedPhone(phone, isTwilioSuppressed, suppressedPhones?)` | Whether the Twilio block covers this number: `false` when the candidate flag is off; every number when the back end gives no `twilio_suppressed_phones`; otherwise only the listed numbers (`toComparablePhone`). Pass the result to `getSmsConsentBlock` / `useSmsConsentBlock` for the selected number |
| `isEveryPhoneTwilioSuppressed(phones, isTwilioSuppressed, suppressedPhones?)` | The same check for all of the candidate's phones — whether an SMS entry point (the **Send text** opener) must be disabled; falls back to the flag when the phones are not loaded |

Single-candidate components should use the `useSmsConsentBlock` hook instead of calling
`getSmsConsentBlock` directly — it reads the A2P registration state from Redux.

### `bulkMessaging.tsx`
The per-candidate result of `POST …/candidate/messaging/bulk` (`BulkMessageResult[]` from `interfaces/messagingCandidate`): `value` is `['OK']`, `'OK'` or the list of reasons why the assessments were not assigned. The back end sends the email to every candidate either way.

| Function | Purpose |
|----------|---------|
| `getBulkMessageFailures(results)` | The candidates that are not OK as `{ company_jobposting_candidate_id, name, errors }`; `name` falls back to `Candidate <id>` |
| `notifyBulkAssessmentFailures(failures)` | One `notification.warning` that stays open (`duration: 0`) under the fixed key `BULK_FAILURES_NOTIFICATION_KEY`: *Assessments were not assigned to N candidates* with every failed candidate in `templates/BulkAssessmentFailures` (a **Name:** reasons line each, scrollable from 240px). A second failed batch replaces it; an empty list closes it |

### `jobPost.ts`
Job post utilities:

| Function | Purpose |
|----------|---------|
| `checkCanPostedJob(description)` | Returns true if description is long enough to post (>100 chars) |
| `hasExplicitPayInDescription(description)` | Detects salary/rate mentions in job description HTML |
| `isUserAssignedToJobPost(managers, userId)` | True when the user is in the job's managers list |
| `buildDefaultNotifications(types, userIds)` | `JobPostNotification[]` for the given type codes, every type with the same recipients |
| `getNotificationRecipients(notifications, type)` / `setNotificationRecipients(notifications, type, userIds)` / `removeNotificationType(notifications, type)` | Read, replace or drop one type's recipients in the job's `notifications` |
| `addRecipientToNotifications(notifications, userId)` / `removeRecipientFromNotifications(notifications, userId)` | Add a manager to every enabled type / remove them from all types (keeps the form in sync with the Managers section) |
| `sanitizeNotifications(notifications, managerIds)` | Keep only recipients that are managers — the back end rejects others with 400 |
| `getJobPostLocation({ jobpost_city, jobpost_state, jobpost_country })` | Location line of a job post as `city, state, country` from the parts that are present (nulls allowed), or `Remote` |
| `applyOwnNotificationTypes(notifications, { user_id, job_notification_types, user_notification_types })` | The job's `notifications` after one user saved their own set: one entry per type of `job_notification_types`, that user added to or removed from each, other recipients kept |

### `urlBuilders.ts`
Scoped links (the `/c/…` or `/cg/…/c/…` prefix comes from `buildPath`):

| Function | Purpose |
|----------|---------|
| `generateJobPostPath(companyId, jobId, template?)` | A job post page; `companyId` may be `undefined` to use the current scope |
| `generateCandidatePath(companyId, jobId, candidateId)` | A candidate profile `/c/:cid/jp/:jid/candidate/:id` |
| `generateResumeScoringCriteriaPath(companyId, jobId)` | Find and Evaluate Talent of the job with `?action=resume_scoring_criteria`, which opens the Resume Scoring Criteria editor |

### `indeedSponsorship.ts`
Indeed sponsored-campaign display and the restart form (sc-45559):

| Function | Purpose |
|----------|---------|
| `formatIndeedBudget({budget_onetime_limit, budget_monthly_limit})` | `$150 total budget` / `$300 monthly budget`, `null` without a budget |
| `formatIndeedPeriod({start_date, end_date, duration_days?})` | `Sep 12, 2026 – Oct 12, 2026 (30 days)` / `Since …, no end date` |
| `getIndeedReasonCopy(reason)` | Plain-language copy of a `non_spending_reasons` entry (`INDEED_REASON_COPY`), falls back to Indeed's description |
| `getRedReasons(reasons)` / `getRestartableReason(reasons)` | Reasons that stop spending (`INDEED_RED_REASONS`) / the first one a restart fixes (`INDEED_RESTARTABLE_REASONS`, never a pause) |
| `toIndeedRestartFormValues(values, type)` / `buildIndeedRestartBody(...)` / `getIndeedRestartEndDateKey(values)` | `restart-defaults` → form values → `POST …/campaign/restart` body; a target end date stays a target |

Any surface quoting an Indeed budget or duration renders `templates/IndeedDisclaimer` (`variant="compact"` in tight spots).

### `jobBoardRepublication.ts`
Job-board republication after unpause (sc-43517):

| Export | Purpose |
|--------|---------|
| `getJobBoardRepublicationBoards(items, pendingSince, publishedCodes, now)` | Per-board UI state `pending` / `stuck` / `failed`; drops `published` entries and boards already live (a manual Publish leaves the entry `failed`) |
| `getJobBoardRepublicationErrorText(message, boardName)` | Known backend messages as they are, `Required field is empty` and `Job posting is not eligible for Indeed sync` explained, raw provider errors → generic retry text |
| `getJobBoardRepublicationRetryKey(jobId, code)` | Key of the `retrying` map in the `jobBoardRepublication` slice |
| `JOB_BOARD_REPUBLICATION_POLL_MS` / `…_STUCK_ON_PAGE_MS` / `…_STUCK_SINCE_UPDATE_MS` | 5 s polling; `pending` counts as stuck after 60 s on the page, or 2 min since `updated_at` when the backend sends it |

Components use `useJobBoardRepublication(jobId, { enabled, onSettled })` from `store/slices/jobBoardRepublication`, not these helpers directly.

### `mobileAuth.ts`
OAuth hand-off from myAccount to the Discovered mobile app (`/access-to/:instance` with a mobile `state`):

| Function | Purpose |
|----------|---------|
| `isMobileAuthState(state, allowExpoGo = IS_DEV)` | `state` is the app deep link (`discovered://…`); `exp://` (Expo Go) is accepted only on dev/stage |
| `buildMobileAuthRedirect(state, params)` | Appends `params` to the deep link with `?` or `&` |

The page only forwards `code` (or the provider `error`) to the app — the app calls `/api/auth/login/social` itself so the refresh token is bound to its own `DeviceID`.

### `storageRedirect.ts`
Return to a storage file after the login:

| Function | Purpose |
|----------|---------|
| `captureStorageRedirect(search)` | Remembers the `redirect_to` target the `/storage` proxies send a signed-out browser to (`localStorage` key `storage_redirect_to`); only relative storage proxy paths are accepted, so it is no open redirect. Called once at boot in `src/index.tsx` |
| `takeStorageRedirect()` | Reads and forgets the remembered file; `finalizeLogon` opens it instead of reloading the page |
| `clearStorageRedirect()` | Forgets the remembered file without opening it — for a page whose login must return to itself (the AI tool approval page) |

### `aiToolsAuthorization.ts`
OAuth request of an AI tool (User MCP):

| Function | Purpose |
|----------|---------|
| `getAiToolsAuthorizationRequest(search)` | The authorization request an AI tool put in the query string (`client_id`, `redirect_uri`, `response_type`, `scope`, `resource`, `code_challenge`, `code_challenge_method`, optional `state`), or `null` when a required parameter is missing. Values are passed on untouched — `client_id` can be an HTTPS URL of up to 512 characters. Used by the approval page (`/ai-tools/authorize`) and by the root fallback in `src/index.tsx` |

### `wrapShortCodes.ts`
Token system for email/SMS templates:

| Function | Purpose |
|----------|---------|
| `replaceTokensToHtml(str, additionalTokens?)` | Converts `{{token_code}}` shortcodes → HTML span elements for Quill editor |
| `replaceHtmlTokens(str)` | Converts Quill HTML token spans back → `{{token_code}}` shortcodes |
| `hasUrlToken(message)` | Checks if message contains any URL-type tokens |

### `permission.ts`
Label generators for permission UI:
```typescript
getLabelPermission(isAll, count, suffix)       // "All Jobs" / "3 Jobs" / "No Jobs"
getLabelPermissionCompany(isAll, count)         // "All Companies" / "2 Companies"
```

### `components.ts`
Small React/DOM helpers:
```typescript
getPopupContainer   // AntD Select prop — keeps dropdown inside parent, prevents z-index issues
stopPropagationOnly // e.stopPropagation() only — use on wrappers around AntD Modal/portals: preventDefault there breaks checkboxes inside
stopPropagation     // stopPropagationOnly + e.preventDefault()
preventDefaultDrag  // drag event stopper
keepScrolledIntoView // (element, duration = 3000) → stop(); scrolls the element into view and again whenever a sibling section above it resizes (late-loading content), until `duration`, the user's own wheel/touch/key scroll, or stop()
```

### `ClientApi.ts`
Axios instance with auth headers, interceptors, and build-version tracking.
**Always import this, never import `axios` directly:**
```typescript
import ClientApi from 'helpers/ClientApi';

const response = await ClientApi.get<ApiResponse<MyType>>('/api/...', { params });
const response = await ClientApi.post('/api/...', body);
```

### `forActions.ts`
Error handling and access data for API calls:

| Function | Purpose |
|----------|---------|
| `runWithAccessData(fn)` | Run `fn` with the effective `{ company_id, company_group_id }` of the URL scope; shows *Full authentication is required…* and returns `undefined` when there is no scope |
| `getErrorMessage(error, fallback?)` | `data.full_message` → `data.message` → `result_text` (not `failure`/`Success`) → top-level `message` (not on 401/419) → `fallback` (default *Some error occurred*) — for showing an error in place instead of a toast. Pass `''` as fallback when the caller has its own default text |
| `getErrorStatus(error)` | HTTP status, or `undefined` without a response |
| `getErrorData(error)` | The error envelope's `data` (`message`, `full_message`, `code`, plus `attempts_left`, `retry_after_seconds`, `retry_after_minutes` on login 2FA errors) — for backend codes such as SMS refusal tokens |
| `isRequestError(error)` | `true` for an axios error — tells a request failure (already toasted by `handleError`) from a local validation `Error` |
| `parseBlobError(error)` | For `responseType: 'blob'` requests: turns a JSON error body back into an object before `getErrorMessage` |
| `handleError(error)` | Error toast with `getErrorMessage`; no toast for 401/419, a guest losing its session or the rest of a denied-scope burst |

All helpers take `error: unknown`. Types live in `interfaces/common.ts`: `ApiResponse<T>`, `PageData<T>`, `ResponseSearch<T>` (= `ApiResponse<PageData<T>>`), `ApiErrorData`, `ApiErrorBody`, `QueryError`.

Rules:
- Never read `error.response…` directly (`get(error, 'response.data.data.message')`, `(error as …).response?.status`) and never show the axios `error.message` — use the helpers above.
- Request generic is `ApiResponse<T>` (the backend envelope), never `AxiosResponse<T>`; endpoints that return a raw body keep their own type.

### `loginMfa.ts`
Login 2FA (sc-46832): the code is bound to the `mfa_token` that `/api/auth/login` returns.

| Export | Purpose |
|--------|---------|
| `parseLoginMfaError(error)` | `{ code, message, isSignInLost, retryAfterSeconds }` from a `pin/request` / `pin/verify` error. `isSignInLost` is `true` for `MFA_TOKEN_INVALID` and `LOGIN_PAUSED` (send the user back to the password form); `message` gets *N attempts left.* appended for `INVALID_PIN` |
| `getResendDelay(sendCount)` | Seconds before the next *Send again*, by the number of codes already sent (the first one comes from `/login`): 30, 30, then 300 — the same schedule as the backend cooldown |
| `MAX_PIN_SENDS` | 5 codes per sign-in; after that the backend answers `MFA_TOKEN_INVALID` |
| `LOGIN_MFA_ERROR` | The backend codes: `INVALID_PIN`, `LOGIN_PAUSED`, `MFA_TOKEN_INVALID`, `PIN_RESEND_COOLDOWN` |

Branch on `code`, never on the message text. A 401 from these endpoints is not toasted by `handleError`, so show `message` explicitly.

### `authWrapper.ts`
Route guards (`userIsAuthenticatedRedir`, `userRoleIsAdminRedir`, etc.).
**Legacy file — do not modify.** See [routing.md](routing.md) for usage context.

### `componentsWrappers.tsx`
`ErrorBoundary` — wrap a UI block in JSX. On a render error it shows the "Something went wrong." fallback and reports through `reportBoundaryError`. A failed dynamic import (a chunk from an older deploy) calls `reloadForStaleBuild()` — one reload per minute per tab — and shows the **Reload** modal when that reload is not allowed. Pass `resetKey` (tab, route, step) to clear the error when the key changes.

### `staleBuild.ts`
`isChunkLoadError(error)` — a failed dynamic import or CSS preload. `reloadForStaleBuild()` — reloads unless another reload happened within a minute or `sessionStorage['stale_build_reload_at']` cannot be written; returns `false` when it did not reload.

### `errorStatus.ts`
`getErrorResponse(error)`, `getErrorStatus(error)` — dependency-free readers of the axios response, shared by `forActions.ts` and the monitoring layer.

`isNotFoundOrForbiddenStatus(status)` — `true` for 404 and 403: the entity is missing or not the user's to open. A page that shows its own *Not Found* state branches on it instead of toasting (sc-47389, job post page).

### `spaviaReport.ts`
Display rules of the company-group monthly report (`views/SpaviaReport`, contract `THT-docs/docs/api/spavia-reporting.md`, sc-45123). Pure, no React; the types come from `store/slices/spaviaReport`. Report components format every figure through these helpers, never inline. Texts, labels, order, `display_name`, `figure` and `figure_label` come from the server and are rendered as sent; the frontend's own copy is in `views/SpaviaReport/constants.ts`, the calendar-date helpers (`formatReportDate`, `formatMonthKey`, `getNextMonthKey`) in `views/SpaviaReport/helpers.ts`.

| Export | Purpose |
|--------|---------|
| `EMPTY_VALUE` (`—`), `UNAVAILABLE_VALUE` (`N/A`) | A dash: nothing to measure in the period. `N/A`: the figure isn't available yet. A missing value is never shown as 0 |
| `formatCount(value)` / `formatPct(value)` / `formatDays(value)` | `1,083` / `42%` / `15.1d`; `—` for `null` or `undefined` |
| `formatScore(value)` | A rating to one decimal (`3.0`) |
| `formatFirstReply(hours)` | `47h` below 48 hours, days to one decimal from 48 (`2d`, `2.2d`) |
| `splitParagraphs(text)` | Server text split on blank lines, trimmed, empty parts dropped; `[]` for `null` |
| `getMeasureDisplay(measure, format, { zeroAsEmpty? })` | `{ text, kind }` of a `SpaviaMeasure`: `unavailable` → `N/A`; `available` with a number → `format(value)` (0 → `—` with `zeroAsEmpty`); anything else → `—`. Components render a measure with `views/SpaviaReport/components/MeasureValue`, which adds the N/A tooltip |
| `isFirstReplySlow(measure)` / `isOldestWaitLong(measure)` / `isNoShowHigh(measure)` | Red-figure thresholds, only for available values: over 24 hours / over 14 days / 35% and over |
| `hasUnavailable(...measures)` | Any of the measures (or action lists) has status `unavailable`: the section shows the N/A note (`UnavailableNote`) |
| `getScoreBand(value)` | `high` from 2.5, `mid` from 2.2, `low` below |
| `getBarWidthPct(value, max)` | Bar width in percent clamped to 0–100; 0 for `null` or `max <= 0` |
| `getMaxComparisonRate(rows)` | Largest hire rate of either group over the `available` rows, 0 when none: the one scale for every comparison bar |
| `getGroupCountsLine(row)` | `22 with · 8 without`, `N/A` for an unknown count |
| `getTopPerformersLine(row)` | `5 of 5 top performers`; `null` when there are no top performers or the number is unknown |
| `getTimeToHireLine(row)` | `Median time to hire: 15.1d with, 28.1d without`, the one-sided forms (`15.1d with. No hires without.`), `null` when neither group hired |
| `getWithheldMessage(row)` | `Not enough locations to compare: only N have this habit` and the `without` and both-groups forms, by `row.reason`; the verb agrees with a single location (`only 1 has this habit`, `only 1 is without it`); the bare prefix for any other reason |
| `getChange(current, prior)` | `{ direction: 'up' \| 'down' \| 'same', pct }`: the change in percent to one decimal, `null` from a prior 0; a change that rounds to 0 is `same` |
| `getHiresCaption(hires, prior, periodLabel)` / `getApplicantsCaption(applicants, prior)` | Network tile captions: `Up 24% from September`, `Same as September`, `Up from 0 in September`, `in <periodLabel>` without a prior / `from 1,083 applicants, down 6.6%`, `null` when applicants are unknown |
| `formatMonthRange(firstKey, lastKey)` | `YYYY-MM` keys → `May to September 2026`, `December 2025 to October 2026`, `October 2026` |
| `getHiresTrendMonths(months)` | The months of `network_health.hires_by_month` to draw. The API always sends 12 months, zero months included; the result starts at the first month with hires and runs to the end, so later zero months and the selected month stay; `[]` when no month has hires, and the chart then shows its empty text. The input is not changed |
| `getLastLoginLabel(lastEntryAt, coverageStatus, tz, dateFormat)` | `last login <date>` in the report zone; without a date `never logged in` only when coverage is `complete`, otherwise `last login unknown` |
| `getTenureLabel(tenureDays, createdDate, dateFormat)` | `835 days on Discovered (since 06/17/24)` (`1 day`); `Days on Discovered N/A` when either value is `null` |
| `filterScorecards(locations, filter, query)` | Scorecards of one group (`filter` is `'all'` or a `SpaviaGroupKey`) whose `name` contains the trimmed query, case-insensitive |
| `countScorecardsByGroup(locations, query)` | Query matches for `all` and each group key: the filter chip counts follow the search |
| `getNoMatchMessage(query, groupLabel?)` | `No locations match "x".`, `No locations match "x" in <group>.`, `No locations in <group>.`, `No locations.` |
| `getAnalysisParts(analysis)` | Analysis parts in server order as `{ key, heading, paragraphs }`, the correlation disclaimer appended once to `shared_habits` (or to the last part); the input is not changed |
| `getGroupReportLabel(groupName?)` | `<group name> Report`, `Report` while the name is missing: the menu button and the Users report-access toggle |

Result types: `MeasureDisplay`, `MeasureDisplayOptions`, `ScoreBand`, `Change`, `ScorecardFilter`, `ScorecardCounts`, `AnalysisPartView`.

### `exportReportPdf.ts`
Client-side PDF of a report page (the back end has no export endpoint), Letter portrait. Pages use it through `views/Reporting/components/ReportPdfButton` (or `ReportExportButtons` in CSS reporting), which shows `templates/BlockingOverlay` and the failure toast.

| Export | Purpose |
|--------|---------|
| `exportReportPdf({ element, fileName, margin? })` | One-canvas path (`html-to-pdf-js`) for the CSS dashboards: rasterizes the whole element once and slices the bitmap into pages, pushing headings, `tr` and `[data-report-avoid-break]` past a page edge. Fine for a few pages; a long document runs into the browser's canvas height limit |
| `exportPagedReportPdf({ element, fileName, margin? })` | Paged path for long reports (`ReportPdfButton paged`, the group report): moves every block that would cross a page edge to the next page (`paginateBlocks`), then rasterizes four pages per `html2canvas` pass and adds one JPEG per page to a `jspdf` document. Margins and layout are restored even when the export fails |
| `paginateBlocks(element, pageHeightPx)` / `getPagePush(top, height, pageHeight)` | The pagination step and its arithmetic (`margin-top` added to a crossing block, a restore function returned; 0 for a block that fits or is taller than a page). Exported for tests |
| `AVOID_BREAK_ATTRIBUTE`, `KEEP_WITH_NEXT_ATTRIBUTE`, `PRINTING_ATTRIBUTE` | Names of the attributes below |

Both take `fileName` without `.pdf`, do nothing for a `null` element and take `margin` in inches (default 0.6; the group report passes `PDF_MARGIN_IN`). While exporting, the element is laid out at the printable width so charts redraw at page size. These attributes drive the export; all of them work in both paths except `data-report-keep-with-next`:

| Attribute | Put on | During the export |
|-----------|--------|-------------------|
| `data-report-no-print` | Toolbars, filters, toggles, buttons, info tips | Hidden |
| `data-report-print-only` | Content for the PDF only (the CSS print meta line), hidden on screen by its own inline `display: none` | Shown with `display: block`, then restored; the attribute alone does not hide anything |
| `data-report-printing` | Set by the exporter on the exported element | Lets styles change the print layout: `:global([data-report-printing]) …` in the module |
| `data-report-avoid-break` | A block | Not cut by a page edge when it fits on one page |
| `data-report-keep-with-next` | An element that also carries `data-report-avoid-break` and must stay with the next block (a section heading) | Paged path only (`exportPagedReportPdf`): moves together with the next block while both fit on one page. Ignored on an element without `data-report-avoid-break`, and by `exportReportPdf` |

A block in the paged path is an element with `data-report-avoid-break` that is not inside another such element and has a layout box (hidden ones are skipped). A block is as wide as the report: cards that sit side by side belong to one block. Content outside a block can be cut, and so can a block taller than a page. Anything more the PDF needs (every group, every list expanded, filters ignored) is the page's own print mode: switch it on in the button's `onBeforeExport` with `flushSync`, so it is rendered before the layout is measured, and off in `onAfterExport` (see `views/SpaviaReport/SpaviaReport.tsx`).

### `reportError.ts`
Statuses of the reporting endpoints that get their own screen (`views/Reporting/components/ReportStateScreen`, with `onRetry`) instead of an error toast:

| Export | Purpose |
|--------|---------|
| `REPORT_STATUS_NO_ACCESS` (403) | The group or the per-user report feature is off |
| `REPORT_STATUS_NOT_FOUND` (404) | The selected cohort or account is gone or belongs to another group |
| `REPORT_STATUS_PAUSED` (503) | The reporting kill switch is on |
| `getReportErrorStatus(error)` | HTTP status of a failed request, `null` without a response |
| `isReportScreenStatus(status)` | `true` for the three statuses above |

A report thunk calls `handleError` only when `!isReportScreenStatus(status)` and passes the status on through `rejectWithValue`; the page decides which of the screens it renders. A 200 answer that holds no report is rejected with `status: null` and no toast; the page shows its generic load error with a retry.

---

## Monitoring (`helpers/monitoring/`)

Error monitoring behind a vendor-neutral facade; Sentry is the first provider (sc-46855). Errors only: no tracing, no session replay. Without `VITE_SENTRY_DSN` at build time no Sentry provider is registered and the SDK is dropped from the bundle. Full description: THT-docs `docs/monitoring/sentry-frontend.md`.

Import from `helpers/monitoring` only. `@sentry/*` is an ESLint error outside `helpers/monitoring/providers/`.

| Export | Purpose |
|--------|---------|
| `reportError(error, context?)` | A caught failure that is a real error. `context`: `level`, `tags`, `extra`, `fingerprint` |
| `reportMessage(message, context?)` | A notable non-error event; rare |
| `addMonitoringBreadcrumb({ category, message, data? })` | Context that explains a later error, such as a state change before a failure |
| `reportApiError(error)` | Called by the `ClientApi` response interceptor only: reports status ≥ 500 outside the expected 503s, grouped by normalized endpoint, throttled per endpoint and status |
| `reportHttpFailure(error, { method, url, status })` | For raw `fetch` calls that bypass `ClientApi` (token refresh) |
| `reportBoundaryError`, `reportStaleBuild` | Called by `ErrorBoundary` only |
| `setMonitoringUser`, `clearMonitoringUser` | Driven by `hooks/useMonitoringUser` (mounted in `AppComponent`) and `clearSession()`; do not call them from features |

Rules:
- Do not report what `ClientApi` already reports: never call `reportError` for an axios error in a `catch`. `handleError` and `showError` do not report.
- Expected states are not errors: 4xx, validation, cancellation, kill switches. An expected 5xx state goes into `EXPECTED_FAILURES` in `monitoring/apiErrors.ts`.
- Never put emails, names, tokens or URLs with query strings into `tags`, `extra` or messages — use ids. `monitoring/scrub.ts` is a safety net, not permission.
- Initialisation is the first import of `src/index.tsx` (`helpers/monitoring/init`); do not initialise anywhere else.
- A new provider is a file in `providers/` plus a line in `createMonitoringProviders()` (`config.ts`); application code does not change.

---

## Hooks (`helpers/hooks/`)

50+ custom hooks. Key ones:

| Hook | Location | Purpose |
|------|----------|---------|
| `useAppSelector` | `hooks/useAppStore.ts` | Typed `useSelector` — always use this |
| `useAppDispatch` | `hooks/useAppStore.ts` | Typed `useDispatch` — always use this |
| `usePermission` | `hooks/usePermission.ts` | Current user's permission level |
| `useQuery` | `hooks/useQuery.ts` | Parse URL query params (`URLSearchParams`) |
| `useCompanyList` | `hooks/useCompanyList.ts` | Company list from Redux |
| `useDebounce` | `hooks/useDebounce.ts` | Debounced value |
| `useEditor` | `hooks/useEditor.ts` | Quill editor ref + helper |
| `useFile` / `useFiles` | `hooks/useFile.ts` | File upload handling |
| `useWindowOnEvent` | `hooks/useWindowOnEvent.ts` | `window.addEventListener` with cleanup |
| `useSmsConsentBlock` | `hooks/useSmsConsentBlock.ts` | SMS consent block for one candidate (`null` = texting allowed) |
| `useUserAccessAvailable` | `hooks/useUserAccessAvailable.ts` | Whether a personal access feature (User API, User MCP) is available to the current user: the current company has the feature, the user has no `disable_*` denial (global or for this company), is assigned to the company as Admin, Editor or Viewer, and is not in group mode. Takes the three feature lists as module-level constants; wrapped by `useUserApiKeyAvailable` (`store/slices/userApiKey`) and `useAiToolsAvailable` (`store/slices/aiTools`) — add a wrapper, do not copy the rule |
| `useNotificationTypes` | `hooks/useNotificationTypes.ts` | Job post notification type catalogue from static data, filtered by the company's services (`{ types, loaded }`) |
| `useBeforeUnloadPrompt` | `hooks/useBeforeUnloadPrompt.ts` | Browser's native leave-page dialog on refresh or tab close while `when` is true; registers no listener otherwise |
| `useResendCooldown` | `hooks/useResendCooldown.ts` | *Send again* lock counted from an absolute deadline: `{ isCoolingDown, secondsLeft, start(seconds?), reset }`. Used by the login code screen and the guest verification |

Unsaved-changes guards live in `templates/UnsavedChanges`: `useUnsavedChangesScope()` + `UnsavedChangesProvider` create a nested scope that renders the shared `UnsavedChangesModal` (the `RouterPrompt` modal) for `scope.confirmDiscard(action)`; inputs call `useReportUnsavedChanges(isDirty)` (no-op outside a provider). Dirty means "value differs from the initial value", never "touched".

For Redux-specific hooks, also check `store/slices/<domain>/hooks/` — slice-local hooks live there.

---

## Other subdirectories

| Path | Contents |
|------|----------|
| `helpers/api/` | Low-level API utilities |
| `helpers/sockets/` | WebSocket connection management |
| `helpers/trackingTools/` | Analytics integrations |
| `helpers/eventManager/` | Internal event bus |

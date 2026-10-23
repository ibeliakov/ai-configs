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

### `date.ts`
Date formatting and timezone handling:

| Function | Purpose |
|----------|---------|
| `getMonthDayYearFormatted(date)` | Format to "MMM DD, YYYY" |
| `getFormattedDateDB(date)` | Format for DB storage |
| `parseDateAnswer(value)` | A free-text answer (screening questions) → local moment when it is exactly `YYYY-MM-DD` (same calendar day, no shift) or a full ISO timestamp; `undefined` for anything else. Pass the result to `useDateFormat`'s `getFormattedDate` and fall back to the raw answer |
| `convertUtcToLocalDate(utc)` | Convert UTC → user's local timezone |
| `getTimeWithTimeZone(date)` | Attach server timezone to date |
| `formatUtcInTimeZone(utc, tz)` | Format UTC in a specific timezone |
| `getStrTimeZone(tz)` | Timezone string with UTC offset |
| `getCurrentTimeZone()` | User's current timezone |
| `getMeetingDateFormatted(date)` | Meeting-specific display format |
| `getTimePeriod(from, to)` | Human-readable date range |
| `getActiveDays(start, end)` | Days between activation and archival |
| `disabledPastDateAndCurrent()` | AntD DatePicker disabledDate helper |
| `getTodayInUsCentral()` | Today's calendar date in `America/Chicago` as a local moment — every Indeed campaign date is US Central |

### `time.ts`
UTC↔local conversion for scheduling:

| Function | Purpose |
|----------|---------|
| `timeToMinutes(time)` | "HH:MM" → minutes from midnight |
| `minutesToTimeValue(minutes)` | Minutes from midnight → "HH:MM:SS" (inverse of `timeToMinutes`) |
| `utcSlotToLocal(slot, tz)` | UTC time slot → local timezone |
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
| `emptyHtmlRegexp` | Empty HTML tags/paragraphs |
| `imageRegexp` | Image file URLs |
| `currencySymbolPayRegex` | "$50,000/year" patterns |
| `currencyCodePayRegex` | "USD 50000 annually" patterns |
| `salaryKeywordPayRegex` | "Salary: $120,000" patterns |
| `salaryKeywordWithPeriodPayRegex` | "Rate: 48.37 per hour" patterns |

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

When you need form validation — check `rulesFields.ts` first. If the rule doesn't exist yet, add it there.

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
```

### `ClientApi.ts`
Axios instance with auth headers, interceptors, and build-version tracking.
**Always import this, never import `axios` directly:**
```typescript
import ClientApi from 'helpers/ClientApi';

const response = await ClientApi.get<AxiosResponse<MyType>>('/api/...', { params });
const response = await ClientApi.post('/api/...', body);
```

### `forActions.ts`
Error handling and access data for API calls:

| Function | Purpose |
|----------|---------|
| `runWithAccessData(fn)` | Run `fn` with the effective `{ company_id, company_group_id }` of the URL scope; shows *Full authentication is required…* and returns `undefined` when there is no scope |
| `getErrorMessage(error, fallback?)` | The back end's `data.full_message` or `data.message`, otherwise `fallback` (default *Some error occurred*) — for showing an error in place instead of a toast |
| `handleError(error)` | Error toast with `getErrorMessage`; no toast for 401, a guest losing its session or the rest of a denied-scope burst |

### `authWrapper.js`
Route guards (`userIsAuthenticatedRedir`, `userRoleIsAdminRedir`, etc.).
**Legacy JS file — do not modify.** See [routing.md](routing.md) for usage context.

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
| `useNotificationTypes` | `hooks/useNotificationTypes.ts` | Job post notification type catalogue from static data, filtered by the company's services (`{ types, loaded }`) |
| `useBeforeUnloadPrompt` | `hooks/useBeforeUnloadPrompt.ts` | Browser's native leave-page dialog on refresh or tab close while `when` is true; registers no listener otherwise |

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

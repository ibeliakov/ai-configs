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

### `date.ts`
Date formatting and timezone handling:

| Function | Purpose |
|----------|---------|
| `getMonthDayYearFormatted(date)` | Format to "MMM DD, YYYY" |
| `getFormattedDateDB(date)` | Format for DB storage |
| `convertUtcToLocalDate(utc)` | Convert UTC → user's local timezone |
| `getTimeWithTimeZone(date)` | Attach server timezone to date |
| `formatUtcInTimeZone(utc, tz)` | Format UTC in a specific timezone |
| `getStrTimeZone(tz)` | Timezone string with UTC offset |
| `getCurrentTimeZone()` | User's current timezone |
| `getMeetingDateFormatted(date)` | Meeting-specific display format |
| `getTimePeriod(from, to)` | Human-readable date range |
| `getActiveDays(start, end)` | Days between activation and archival |
| `disabledPastDateAndCurrent()` | AntD DatePicker disabledDate helper |

### `time.ts`
UTC↔local conversion for scheduling:

| Function | Purpose |
|----------|---------|
| `timeToMinutes(time)` | "HH:MM" → minutes from midnight |
| `utcSlotToLocal(slot, tz)` | UTC time slot → local timezone |
| `convertFreeRangesToTimezone(ranges, tz)` | Convert availability ranges, handles cross-midnight splits |

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

Contains rule builders for: email, password, phone, URL, postal code, company name (async uniqueness check), subdomain (async uniqueness check), LinkedIn ID, job description, screening questions, SMS templates, template tokens, benefits, status names.

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

### `jobPost.ts`
Job post utilities:

| Function | Purpose |
|----------|---------|
| `checkCanPostedJob(description)` | Returns true if description is long enough to post (>100 chars) |
| `hasExplicitPayInDescription(description)` | Detects salary/rate mentions in job description HTML |

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
stopPropagation     // e.stopPropagation() + e.preventDefault()
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

For Redux-specific hooks, also check `store/slices/<domain>/hooks/` — slice-local hooks live there.

---

## Other subdirectories

| Path | Contents |
|------|----------|
| `helpers/api/` | Low-level API utilities |
| `helpers/sockets/` | WebSocket connection management |
| `helpers/trackingTools/` | Analytics integrations |
| `helpers/eventManager/` | Internal event bus |

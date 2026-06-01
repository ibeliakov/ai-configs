# API layer rules

`src/api/` contains pure HTTP functions organized by domain.
Before writing a new API function, check if one already exists here.

---

## Core rule

- **Always** use `src/api/axios.ts` — never `import axios` directly
- API functions are **pure** — they receive `accessData: AccessData` as an explicit parameter
- Auth context (`company_id`, `company_group_id`) is injected from `actions.ts` via `runWithAccessData` — **not inside API functions**
- Token refresh is handled automatically by the axios interceptor

---

## File organization

Files are organized by domain:

```
src/api/
  axios.ts          ← Axios instance with interceptors (token refresh, auth headers)
  authApi.ts        ← login, OTP, token operations
  candidateApi.ts   ← candidate CRUD, communications, assessments
  jobPostApi.ts     ← job post operations, candidate lists
  companyApi.ts     ← company info, settings
  emailApi.ts       ← email send, templates
  scorecardApi.ts   ← assessment scorecards
```

---

## Function structure

Each function is a **pure async function** that:
1. Receives typed parameters + `accessData: AccessData`
2. Calls the axios instance
3. Returns typed response data (or throws — error handling is done in `actions.ts`)

```typescript
import api from './axios';
import type { AccessData } from '../types/common';
import type { Candidate, ListParams } from '../types/candidate.types';

export const getList = (
  params: ListParams,
  accessData: AccessData,
) =>
  api.get<{ data: { items: Candidate[]; total: number } }>(
    '/api/v2/myaccount/jobposting/candidates',
    {
      params: { ...accessData, ...params },
    },
  );

export const updateRating = (
  candidateId: number,
  rating: number,
  accessData: AccessData,
) =>
  api.put('/api/myaccount/jobposting/candidate/rating', {
    company_jobposting_candidate_id: candidateId,
    rating,
    ...accessData,
  });
```

---

## Rules

- Write API URLs **inline** — do not extract them into constants
- No error handling inside API functions — throw, let `actions.ts` call `handleError`
- No `runWithAccessData` inside API functions — it belongs in `actions.ts`
- No Redux imports — API layer must be independent of the store
- Responses are typed via generics: `api.get<{ data: MyType }>(...)`

---

## axios.ts

The Axios instance has interceptors for:
- Adding `Authorization: Bearer <token>` header to every request
- Automatic token refresh on 401 (via `tokenManager.ts`)
- Redirecting to login on auth failure

Do not modify `axios.ts` unless changing global request/response behavior.

---

## Endpoints that don't need `accessData`

Some endpoints (auth, public) don't need `company_id`/`company_group_id`.
For these, omit `accessData` from the function signature:

```typescript
export const login = (email: string, password: string) =>
  api.post<{ data: AuthTokens }>('/api/auth/login', { email, password });

export const verifyOtp = (otp: string, token: string) =>
  api.post<{ data: AuthTokens }>('/api/auth/verify', { otp, token });
```

---

## Consuming API functions from actions

```typescript
// actions.ts
import * as candidateApi from 'api/candidateApi';

export const fetchCandidates = createAsyncThunk(
  'candidates/fetch',
  async (params: ListParams, { rejectWithValue }) => {
    const { runWithAccessData } = await import('helpers/accessData');
    return runWithAccessData(async (accessData) => {
      try {
        const response = await candidateApi.getList(params, accessData);
        return response.data.data;
      } catch (error) {
        handleError(error);
        return rejectWithValue(error);
      }
    });
  }
);
```

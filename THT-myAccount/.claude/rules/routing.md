# Routing & permissions

## How routes are defined

All routes live in `src/pages/routeItems/`, split by permission level:

```
pages/routeItems/
  index.ts                  ← merges all arrays into ROUTER_ITEMS
  type.ts                   ← RouteItem type
  authRouteItems.ts         ← USER_IS_AUTH
  notAuthRouteItems.ts      ← USER_IS_NOT_AUTH
  adminRouteItems.ts        ← USER_IS_ADMIN
  editorRouteItems.ts       ← USER_IS_EDITOR
  guestRouteItems.ts        ← USER_IS_GUEST
  commonRouteItems.ts       ← USER_IS_COMMON (no auth required)
  companyGroupRouteItems.ts ← USER_IS_GROUP
```

`Router.tsx` iterates `ROUTER_ITEMS` and wraps each component with the appropriate HOC via `functionInvoke()`.

## RouteItem type

```typescript
type RouteItem = {
  path: string;
  component: any;
  permission:
    | 'USER_IS_NOT_AUTH'
    | 'USER_IS_AUTH'
    | 'USER_IS_ADMIN'
    | 'USER_IS_EDITOR'
    | 'USER_IS_GUEST'
    | 'USER_IS_COMMON'
    | 'USER_IS_GROUP';
  billingPermission?: ServiceCode[];   // required billing features
  typePermission?: 'some' | 'every';  // default: 'some'
};
```

## Permission levels

| Constant | Who can access |
|----------|---------------|
| `USER_IS_NOT_AUTH` | Only unauthenticated users (login, registration pages) |
| `USER_IS_AUTH` | Any authenticated user |
| `USER_IS_ADMIN` | Admin role only |
| `USER_IS_EDITOR` | Editor role only |
| `USER_IS_GROUP` | Company group users; falls back to admin if not a group |
| `USER_IS_GUEST` | Guest access (no auth check) |
| `USER_IS_COMMON` | No auth check at all |

## Adding a new route

**Before writing any code, always ask the user:**

1. **Permission level** — which of the 7 constants applies? (see table above)
2. **Billing permission** — does this route require any paid features (`ServiceCode[]`)? If yes:
3. **typePermission** — `'some'` (at least one feature active) or `'every'` (all features required)?

Do not assume defaults and proceed — always clarify all three points first.

Once confirmed, add an entry to the correct `*RouteItems.ts` array:

```typescript
// authRouteItems.ts
import MyNewPage from 'pages/MyNewPage';
import { PATH_MY_NEW_PAGE } from 'constants/urlList';

const AUTH_ROUTE_ITEMS: RouteItem[] = [
  // ...existing routes
  {
    path: PATH_MY_NEW_PAGE,
    component: MyNewPage,
    permission: USER_IS_AUTH,
  },
];
```

3. Add the path constant to `constants/urlList.ts`.
4. Do **not** add routes directly to `Router.tsx`.

## Billing permissions

Some routes require the company to have specific paid features enabled:

```typescript
{
  path: PATH_ASSESSMENTS,
  component: AssessmentsList,
  permission: 'USER_IS_AUTH',
  billingPermission: ['assessments'],
  typePermission: 'some', // at least one of the listed features must be active
}
```

- `typePermission: 'some'` — user needs **at least one** of the listed `ServiceCode` values
- `typePermission: 'every'` — user needs **all** of the listed values
- If `billingPermission` is omitted, no billing check is performed

`ServiceCode` values are defined in `interfaces/billing.ts`.

## Auth wrappers

Route guards live in `helpers/authWrapper.js` — this is **legacy JS code, do not modify**.

The wrappers use `redux-auth-wrapper` (`connectedRouterRedirect`) to redirect users who fail the permission check. Logic:
- Checks auth state from Redux
- Checks user role
- Checks billing permissions via `hasBillingPermission()`

## Pages vs Views

**`pages/`** — route-level shells only:
- Registered in `routeItems`
- Import one or more `views/` components
- Handle route params (`useParams`, `useQuery`)
- Minimal logic — mostly composition and layout

**`views/`** — feature components:
- Not directly route-registered
- Contain business logic, connect to Redux
- Compose `templates/` components

Do not put business logic in `pages/`. Do not register `views/` directly as routes.

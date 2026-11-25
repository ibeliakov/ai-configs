# Routing & permissions

## How routes are defined

All routes live in a single file: `src/pages/routeItems.js`.

The file exports a `ROUTER_ITEMS` object keyed by permission level:

```javascript
const ROUTER_ITEMS = {
  [USER_IS_NOT_AUTH]: [
    { path: '/', component: Logon },
    { path: '/verification', component: LoginVerification },
  ],
  [USER_IS_AUTH]: [
    { path: '/company-list', component: CompanyList },
    // ...
  ],
  [USER_IS_ANY]: [
    // ...
  ],
};

export default ROUTER_ITEMS;
```

`Router.js` reads `ROUTER_ITEMS` and wraps each component with the appropriate auth HOC from `helpers/authWrapper.js`; a `USER_IS_ANY` component is rendered as is.

## Permission levels

| Constant | Who can access |
|----------|----------------|
| `USER_IS_NOT_AUTH` | Only unauthenticated users (login, verification pages) |
| `USER_IS_AUTH` | Any authenticated user |
| `USER_IS_ANY` | Everyone, signed in or not: the route renders without an auth wrapper and never redirects. Used by `/connect-claude` (`PATH_CONNECT_CLAUDE`, sc-47613) |

All three constants are imported from `constants/index`.

A `USER_IS_ANY` page handles both states itself. `views/App/AppComponent.tsx` reloads the page when another tab signs in or out, except on `PATH_CONNECT_CLAUDE`; a new `USER_IS_ANY` page that must keep its state through such a change needs the same exception.

## Adding a new route

**Before writing any code, confirm with the user:**

1. **Permission level** — `USER_IS_AUTH`, `USER_IS_NOT_AUTH` or `USER_IS_ANY`? `USER_IS_ANY` only for a page that must open both with and without a session.

Once confirmed:

1. Import the page component in `routeItems.js`
2. Add a path constant to `constants/urlPath.ts`
3. Import the path constant in `routeItems.js`
4. Add the route entry under the correct permission key in `ROUTER_ITEMS`

**Do not add routes directly to `Router.js`.**

Example:
```javascript
// routeItems.js
import MyNewPage from './MyNewPage';
import { PATH_MY_NEW_PAGE } from 'constants/urlPath';

const ROUTER_ITEMS = {
  // ...
  [USER_IS_AUTH]: [
    // ...existing routes
    {
      path: PATH_MY_NEW_PAGE,
      component: MyNewPage,
    },
  ],
};
```

```typescript
// constants/urlPath.ts
export const PATH_MY_NEW_PAGE = '/my-new-page';
```

## Auth wrappers

Route guards live in `helpers/authWrapper.js` — this is **legacy JS code, do not modify**.

The wrappers use `redux-auth-wrapper` to redirect users who fail the permission check.

## Pages vs Views

**`pages/`** — route-level shells only:
- Registered in `routeItems.js`
- Import one or more `views/` components
- Handle route params (`useParams`, `useQuery`)
- Minimal logic — mostly composition and layout

**`views/`** — feature components:
- Not directly route-registered
- Contain business logic, connect to Redux
- Compose `templates/` components

Do not put business logic in `pages/`. Do not register `views/` directly as routes.

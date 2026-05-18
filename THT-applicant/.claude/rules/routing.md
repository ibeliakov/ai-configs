# Routing & SSR

## How routes work

THT-applicant uses **Next.js 13 file-based routing** — there is no `routeItems.js` or `Router.tsx`.

Routes are created by adding files to the `pages/` directory:

```
pages/
  index.tsx              → /
  404.tsx                → custom 404
  _app.tsx               → app wrapper (do not restructure)
  _document.tsx          → HTML document (do not modify unless needed)
  application-form/
    index.tsx            → /application-form
  interview/
    [id].tsx             → /interview/:id   (dynamic route)
```

## Adding a new route

1. Create `pages/my-route/index.tsx` (preferred for multi-file routes) or `pages/my-route.tsx`
2. Add a path constant to `src/constants/`:
   ```typescript
   // src/constants/urlPath.ts (or similar)
   export const PATH_MY_ROUTE = '/my-route';
   ```
3. Use the constant in `<Link href={PATH_MY_ROUTE}>` — never hardcode path strings

**Do not modify `pages/_app.tsx` to register routes** — file placement is the registration.

## SSR with next-redux-wrapper

Pages that need server-side data use `wrapper.getServerSideProps`:

```typescript
import { wrapper } from '@src/store/configureStore';

export const getServerSideProps = wrapper.getServerSideProps(
  (store) => async (context) => {
    await store.dispatch(someAction());
    return { props: {} };
  }
);
```

### Subdomain extraction

The applicant portal is subdomain-based. Extract subdomain in `getServerSideProps`:

```typescript
export const getServerSideProps = wrapper.getServerSideProps(
  (store) => async ({ req, query }) => {
    const host = req?.headers?.host ?? '';
    const subdomain = host.split('.')[0]; // or from query.subdomain in dev
    // ...
    return { props: { subdomain } };
  }
);
```

In development, subdomain may come from query params (`?subdomain=...`).

## Special Next.js files

| File | Purpose | Rule |
|------|---------|------|
| `pages/_app.tsx` | Redux Provider, auth token sync, device tracking | Do not restructure |
| `pages/_document.tsx` | HTML `<head>`, fonts, meta | Modify only for document-level changes |
| `pages/404.tsx` | Custom 404 page | Modify only when explicitly asked |

## Pages vs Views vs Templates

**`components/pages/`** — page-level shells:
- Rendered by Next.js route files in `pages/`
- Import one or more `views/` components
- Handle route params, query strings
- Minimal logic — mostly composition and layout

**`components/views/`** — feature components:
- Not directly route-registered
- Contain business logic, connect to Redux
- Compose `templates/` components

**`components/templates/`** — reusable presentational components:
- No Redux, no business logic
- Receive everything via props

Rule: templates → views → pages. Never the other way around.

## Navigation

Use Next.js `<Link>` for internal navigation:
```typescript
import Link from 'next/link';
import { useRouter } from 'next/router';

// declarative
<Link href={PATH_MY_ROUTE}>Go somewhere</Link>

// programmatic
const router = useRouter();
router.push(PATH_MY_ROUTE);
```

Never use `<a href>` for internal routes.

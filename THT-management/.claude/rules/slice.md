# Redux slice rules

All new Redux code is Redux Toolkit (`@reduxjs/toolkit` 1.9): `createSlice` + `createAsyncThunk`.
Do not add new switch-case reducers or `createAction` constants (`actions/actionConstants.js`).

Reference implementation: `src/store/slices/jobTypes`.

## Folder structure

```
store/slices/<domain>/
  index.ts          ← public API, only re-exports
  slice.ts          ← createSlice
  actions.ts        ← createAsyncThunk + API functions
  selectors.ts      ← plain selectors + createSelector
  types.ts          ← domain types
  hooks.ts          ← if there is only one hook
  hooks/            ← if there are multiple hooks
    index.ts
    useXxx.ts
  slice.test.ts     ← vitest, for non-trivial reducers/thunks
```

After creating a new slice, register its reducer in `src/reducers/index.ts`.

## `types.ts`

Domain types only. Use `LoadStatus` for async state:

```typescript
import { LoadStatus } from 'interfaces/common';

export type MyDomainState = {
  items: Item[];
  loading: LoadStatus;
};
```

Always use `type`, never `interface`. Export inline (`export type X = ...`) — the project's Prettier 1.x cannot parse `export type { X }`.

## `slice.ts`

```typescript
import { createSlice } from '@reduxjs/toolkit';
import { getItems } from './actions';
import { MyDomainState } from './types';

const initialState: MyDomainState = {
  items: [],
  loading: 'not loaded',
};

const myDomainSlice = createSlice({
  name: 'myDomain',
  initialState,
  reducers: {
    clearItems: state => {
      state.items = [];
      state.loading = 'not loaded';
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getItems.pending, state => {
        state.loading = 'loading';
      })
      .addCase(getItems.fulfilled, (state, action) => {
        state.loading = 'loaded';
        state.items = action.payload;
      })
      .addCase(getItems.rejected, state => {
        state.loading = 'error';
      });
  },
});

export default myDomainSlice;
```

Rules:
- `name` must exactly match the folder name and the key in `rootReducer`.
- Immer allows direct mutation inside reducers — use it, don't spread manually unless needed.
- `extraReducers` always uses the builder pattern.

## `actions.ts`

### Async thunks — `createAsyncThunk`

Use for every request whose result or loading state lives in Redux:

```typescript
import { createAsyncThunk } from '@reduxjs/toolkit';
import { AxiosResponse } from 'axios';
import ClientApi from 'helpers/ClientApi';
import { handleError } from 'helpers/forActions';
import { RootState } from 'reducers';

export const getItems = createAsyncThunk<
  Item[],
  { company_group_id: number },
  { state: RootState }
>('myDomain/getItems', async ({ company_group_id }, { rejectWithValue }) => {
  try {
    const response = await ClientApi.get<AxiosResponse<Item[]>>(
      '/api/management/items',
      { params: { company_group_id } }
    );
    return response.data.data;
  } catch (error) {
    handleError(error);
    return rejectWithValue(error);
  }
});
```

Rules:
- Type the thunk with `createAsyncThunk<Returned, Arg, { state: RootState }>` so `getState()` is typed.
- Management has no access scope (no `runWithAccessData`): pass `company_id` / `company_group_id` explicitly as thunk args.
- Write API URLs inline — do not extract them into constants. This makes it easier to find the failing action by URL in the network tab.
- Always call `handleError(error)` before `rejectWithValue`. Error text for UI comes from `getErrorMessage` (`helpers/forActions`).
- The thunk name prefix is the slice name: `'<domain>/<action>'`.

### Preventing duplicate requests — use `condition`

Instead of module-level boolean flags (`busyRuns`, `busyQuery`) use the `condition` option. The thunk does not run (and dispatches nothing) when it returns `false`:

```typescript
{
  condition: (_, { getState }) => getState().myDomain.loading !== 'loading',
}
```

- `!== 'loading'` drops only parallel duplicates and still allows an explicit reload.
- `=== 'not loaded'` loads once per session — use it only when the data never needs a reload.

### Plain API functions

When a request does not need Redux state, write a plain async function that only does the HTTP call and returns data:

```typescript
export const deleteItem = async (item_id: number): Promise<void> => {
  await ClientApi.delete('/api/management/items', { params: { item_id } });
};
```

Do not call `store.dispatch` from action files — this replaces the old pattern of plain async functions that dispatched into the store directly. The calling hook or component dispatches any follow-up thunk/action.

## `selectors.ts`

**Plain selector** — direct state access, with an explicit return type:

```typescript
export const selectItems = (state: RootState): Item[] => state.myDomain.items;

export const selectItemsLoading = (state: RootState): LoadStatus =>
  state.myDomain.loading;
```

**`createSelector`** (from `@reduxjs/toolkit`) — for derived data. Keep a stable empty reference outside the selector to avoid unnecessary re-renders:

```typescript
import { createSelector } from '@reduxjs/toolkit';

const EMPTY_ITEMS: Item[] = [];

export const selectActiveItems = createSelector(selectItems, items => {
  const active = items.filter(i => i.active);
  return active.length ? active : EMPTY_ITEMS;
});
```

## `hooks.ts` / `hooks/`

- **One hook** → `hooks.ts`
- **Multiple hooks** → `hooks/` folder with `index.ts` re-exporting all hooks, one hook per file

Each hook:
- Has an explicit return type defined as a `type` above the function
- Uses `useAppDispatch` / `useAppSelector` — never raw `useSelector`/`useDispatch` (ESLint `no-restricted-imports`)
- Is responsible for triggering data loading (`useEffect` + dispatch) when needed
- Does not duplicate the `condition` guard from the thunk

```typescript
import { useEffect } from 'react';
import useAppDispatch from 'hooks/useAppDispatch';
import { useAppSelector } from 'hooks/useAppSelector';
import { getItems } from './actions';
import { selectItems, selectItemsLoading } from './selectors';

type UseItems = {
  items: Item[];
  isLoading: boolean;
};

export const useItems = (company_group_id: number): UseItems => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectItems);
  const loading = useAppSelector(selectItemsLoading);

  useEffect(() => {
    dispatch(getItems({ company_group_id }));
  }, [dispatch, company_group_id]);

  return {
    items,
    isLoading: loading === 'loading',
  };
};
```

## `index.ts`

The public API of the slice. Consumers import **only from the slice folder**, never from internal files:

```typescript
// ✅
import { useItems } from 'store/slices/myDomain';

// ❌
import { useItems } from 'store/slices/myDomain/hooks';
```

Export only what is consumed outside the folder — `npm run dead-code` (knip) flags unused exports.

```typescript
import myDomainSlice from './slice';

export const { clearItems } = myDomainSlice.actions;

export { getItems } from './actions';

export { selectItems } from './selectors';

export { useItems } from './hooks';

export default myDomainSlice.reducer;
```

## Tests

Non-trivial slices get `slice.test.ts` (vitest). See `store/slices/jobTypes/slice.test.ts`:
- reducer cases via the thunk action creators (`getItems.pending('r1')`, `getItems.fulfilled(data, 'r1')`, `getItems.rejected(null, 'r1')`);
- thunks against a minimal store built like production (`createStore` + `applyMiddleware(thunk)`), with `vi.mock('helpers/ClientApi')`.

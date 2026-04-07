# Redux slice rules

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
  socket.ts         ← only if the slice uses WebSocket
```

After creating a new slice, register its reducer in `src/reducers/index.ts`.

## `types.ts`

Domain types only. Use `LoadStatus` for async state:

```typescript
import { LoadStatus } from 'interfaces/common';

type MyDomainState = {
  items: Item[];
  loading: LoadStatus;
};

export type { MyDomainState };
```

Always use `type`, never `interface`.

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
  name: 'myDomain',         // ← must match the folder name exactly
  initialState,
  reducers: {
    clearItems: (state) => {
      state.items = [];
      state.loading = 'not loaded';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getItems.pending, (state) => {
      state.loading = 'loading';
    });
    builder.addCase(getItems.fulfilled, (state, action) => {
      state.loading = 'loaded';
      state.items = action.payload;
    });
    builder.addCase(getItems.rejected, (state) => {
      state.loading = 'error';
    });
  },
});

export default myDomainSlice;
```

Rules:
- `name` must exactly match the folder name — this is mandatory. Mismatches are legacy bugs.
- Immer allows direct mutation inside `reducers` — use it, don't spread manually unless needed.
- `extraReducers` always uses builder pattern.

## `actions.ts`

### Async thunks — `createAsyncThunk`

Use for all operations that need loading state in Redux:

```typescript
import { createAsyncThunk } from '@reduxjs/toolkit';
import ClientApi from 'helpers/ClientApi';
import { handleError, runWithAccessData } from 'helpers/forActions';
import { GetState } from 'interfaces/common';

export const getItems = createAsyncThunk(
  'myDomain/getItems',
  async (_, { getState, rejectWithValue }) =>
    runWithAccessData(getState as GetState, async (access_data) => {
      try {
        const response = await ClientApi.get('/api/myaccount/items', {
          params: { ...access_data },
        });
        return response.data.data;
      } catch (error) {
        handleError(error);
        return rejectWithValue(error);
      }
    })
);
```

Rules:
- Always use `runWithAccessData` (not `runWithCompanyGroupId` — we are migrating away from it).
- Write API URLs inline — do not extract them into constants. This makes it easier to find the failing action by URL in the network tab.
- Always call `handleError(error)` before `rejectWithValue`.

### Preventing duplicate requests — use `condition`

Instead of module-level boolean flags (`busyQuery`) or loading guards in hooks (`if (loading === 'loaded') return`), use the `condition` option in `createAsyncThunk`:

```typescript
export const getItems = createAsyncThunk(
  'myDomain/getItems',
  async (_, { getState, rejectWithValue }) =>
    runWithAccessData(getState as GetState, async (access_data) => {
      try {
        const response = await ClientApi.get('/api/myaccount/items', {
          params: { ...access_data },
        });
        return response.data.data;
      } catch (error) {
        handleError(error);
        return rejectWithValue(error);
      }
    }),
  {
    condition: (_, { getState }) => {
      const state = (getState as GetState)();
      return state.myDomain.loading === 'not loaded';
    },
  }
);
```

The thunk will not run if `condition` returns `false`. No pending/fulfilled/rejected actions are dispatched.

### Plain API functions

When you need to make a request without Redux loading state — create a plain async function that only handles the HTTP call and returns data:

```typescript
export const postItemFavorite = async (
  item_id: number,
  favorite: boolean
): Promise<void> =>
  runWithAccessData(store.getState as GetState, async (access_data) => {
    await ClientApi.post('/api/myaccount/items/favorites', {
      ...access_data,
      item_id,
      favorite,
    });
  });
```

This replaces the old pattern of plain async functions that called `store.dispatch` directly. The calling hook or component is responsible for dispatching any follow-up actions.

## `selectors.ts`

**Plain selector** — for direct state access:
```typescript
export const selectItems = (state: RootState): Item[] =>
  state.myDomain.items;

export const selectLoading = (state: RootState): LoadStatus =>
  state.myDomain.loading;
```

**`createSelector`** — for derived/computed data. Use a stable empty reference outside the selector to avoid unnecessary re-renders:

```typescript
import { createSelector } from '@reduxjs/toolkit';

const EMPTY_ITEMS: Item[] = []; // stable reference — defined outside

export const selectActiveItems = createSelector(
  selectItems,
  (items) => items.filter((i) => i.active) || EMPTY_ITEMS
);
```

## `hooks.ts` / `hooks/`

- **One hook** → `hooks.ts`
- **Multiple hooks** → `hooks/` folder with `index.ts` re-exporting all hooks, one hook per file

Each hook:
- Has an explicit return type defined as a `type` above the function
- Uses `useAppSelector` and `useAppDispatch` — never raw `useSelector`/`useDispatch`
- Is responsible for triggering data loading (via `useEffect` + dispatch) when needed
- Does not duplicate the `condition` guard from the thunk — the thunk handles deduplication

```typescript
import { useAppDispatch, useAppSelector } from 'helpers/hooks/useAppStore';
import { useEffect } from 'react';
import { getItems } from './actions';
import { selectItems, selectLoading } from './selectors';

type UseItems = {
  items: Item[];
  isLoading: boolean;
};

export const useItems = (): UseItems => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectItems);
  const loading = useAppSelector(selectLoading);

  useEffect(() => {
    dispatch(getItems());
  }, [dispatch]);

  return {
    items,
    isLoading: loading === 'loading',
  };
};
```

## `index.ts`

The public API of the slice. All consumers import **only from the slice folder**, never from internal files:

```typescript
// ✅
import { useItems, getItems, selectItems } from 'store/slices/myDomain';

// ❌
import { useItems } from 'store/slices/myDomain/hooks';
import { selectItems } from 'store/slices/myDomain/selectors';
```

Structure of `index.ts`:

```typescript
import myDomainSlice from './slice';

// sync action creators
export const { clearItems } = myDomainSlice.actions;

// async thunks
export { getItems, postItemFavorite } from './actions';

// selectors
export { selectItems, selectLoading, selectActiveItems } from './selectors';

// hooks
export { useItems } from './hooks';

// reducer — consumed by reducers/index.ts
export default myDomainSlice.reducer;
```

# Redux

## All code is legacy pattern

This project uses the **legacy Redux pattern only**. There is no `@reduxjs/toolkit`.

Do not use `createSlice`, `createAsyncThunk`, or any RTK APIs.

## Folder layout

```
src/
  actions/        action creators with redux-thunk
  reducers/       switch-case reducers
  store/
    configureStore.ts   store bootstrap + next-redux-wrapper HYDRATE handling
    slices/             domain reducers (legacy switch-case, NOT RTK)
  selectors/      reselect selectors
```

## Writing new Redux code

Follow the switch-case pattern from the nearest existing slice. Example:

```typescript
// src/store/slices/myDomain/index.ts

const initialState = {
  items: [] as MyItem[],
  loadStatus: 'not loaded' as LoadStatus,
};

type State = typeof initialState;

export const myDomainReducer = (
  state: State = initialState,
  action: AnyAction
): State => {
  switch (action.type) {
    case MY_DOMAIN_LOAD:
      return { ...state, loadStatus: 'loading' };
    case MY_DOMAIN_LOAD_SUCCESS:
      return { ...state, items: action.payload, loadStatus: 'loaded' };
    case MY_DOMAIN_LOAD_ERROR:
      return { ...state, loadStatus: 'error' };
    default:
      return state;
  }
};
```

Action constants go in the same file or `src/constants/`.

## Action creators

Use redux-thunk style:

```typescript
// src/actions/myDomainActions.ts
import ClientApi from '@src/helpers/ClientApi';
import { handleError } from '@src/helpers/forActions';

export const loadMyDomain = (id: number) => async (dispatch: Dispatch) => {
  dispatch({ type: MY_DOMAIN_LOAD });
  try {
    const response = await ClientApi.get(`/api/my-domain/${id}`);
    dispatch({ type: MY_DOMAIN_LOAD_SUCCESS, payload: response.data.data });
  } catch (error) {
    dispatch({ type: MY_DOMAIN_LOAD_ERROR });
    handleError(error);
  }
};
```

## Accessing state in components

```typescript
import { useAppDispatch } from '@src/hooks/useAppDispatch';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store/configureStore';

const dispatch = useAppDispatch();
const items = useSelector((state: RootState) => state.myDomain.items);
```

- Always use `useAppDispatch` — never raw `useDispatch`
- Use `useSelector` from `react-redux`, typed with `RootState`

## next-redux-wrapper

The store is wrapped with `next-redux-wrapper` for SSR support. The `HYDRATE` action synchronizes server-side state to the client.

- HYDRATE handling is in `src/store/configureStore.ts` — **do not break this logic**
- In `getServerSideProps`, always use `wrapper.getServerSideProps` — never create a store manually

## Do not modify

| Path | Note |
|------|------|
| `src/store/configureStore.ts` | Store bootstrap + HYDRATE — do not restructure |
| `src/actions/` | Modify only when the task specifically targets these files |
| `src/reducers/` | Modify only when the task specifically targets these files |

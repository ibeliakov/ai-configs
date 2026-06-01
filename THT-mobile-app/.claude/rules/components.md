# Component rules

## Folder structure

New components must follow this structure:

```
ComponentName/
  index.ts                  ← re-export only
  ComponentName.tsx
  ComponentName.types.ts
  ComponentName.styles.ts   ← StyleSheet.create(...)
  components/               ← subcomponents (if needed)
  hooks/                    ← hooks specific to this component (if needed)
```

`index.ts` is a barrel — only re-exports, no logic:
```typescript
export { default } from './ComponentName';
```

Existing components that don't follow this structure are old code — do not retrofit them.

## Code order inside a component

```
1. Redux          — useAppDispatch, useAppSelector + selectors
2. Refs & data hooks — useRef, hooks that read/transform data (useDebounce...)
3. useState
4. Plain variables — no memoization
5. useMemo
6. Callbacks & handlers
7. useEffect
8. Event/effect hooks — hooks whose main logic is side effects or subscriptions
9. Early returns
10. return JSX
```

**The rule for hooks position:** if a hook's primary purpose is reading or transforming data, it goes near the top (after Redux). If its primary purpose is handling events or triggering effects — it goes after `useEffect`.

Example:
```typescript
const MyComponent: FC<Props> = ({ candidateId }) => {
  // 1. Redux
  const dispatch = useAppDispatch();
  const candidate = useAppSelector(selectCandidate);

  // 2. Refs & data hooks
  const listRef = useRef<ScrollView>(null);

  // 3. State
  const [isOpen, setIsOpen] = useState(false);

  // 4. Plain variables
  const title = candidate?.name ?? 'Unknown';

  // 5. Memo
  const activeStatuses = useMemo(
    () => statuses.filter((s) => s.active),
    [statuses]
  );

  // 6. Handlers
  const handleClose = useCallback(() => setIsOpen(false), []);

  // 7. Effects
  useEffect(() => {
    dispatch(loadCandidate(candidateId));
    return () => dispatch(clearCandidate());
  }, [candidateId, dispatch]);

  // 9. Early returns
  if (!candidate) return null;

  // 10. Render
  return <ScrollView ref={listRef}>...</ScrollView>;
};
```

## Props typing

Always use `type`, never `interface`. Props live in `ComponentName.types.ts`:

```typescript
// ComponentName.types.ts
type Props = {
  candidateId: number;
  onClose: () => void;
  variant?: 'primary' | 'secondary';
};

export type { Props };
```

When wrapping a native element, extend via intersection:
```typescript
import type { ViewProps } from 'react-native';

type Props = ViewProps & {
  variant?: 'primary' | 'secondary';
};
```

## Subcomponents

Split into a subcomponent when a section of JSX:
- Has its own local state
- Is logically self-contained (a distinct UI section, not just visual grouping)
- Is reused in more than one place

Do **not** split just because JSX is long. Split when sections are independently meaningful.

Subcomponents go into `components/` and follow the same folder structure.
They are imported by the parent — never the other way around.

## Styles

- `StyleSheet.create()` for all new components — in `ComponentName.styles.ts`
- Conditional styles via array syntax: `[styles.base, isActive && styles.active].filter(Boolean)`
- Inline styles only for dynamic CSS values (e.g. `style={{ width: dynamicValue }}`)
- Colors and spacing from theme tokens — do not hardcode `#hex` values
- Do not override Ant Design styles with inline styles — use `style` prop or theme

## Redux

Always use typed hooks — never raw `useSelector`/`useDispatch`:
```typescript
import { useAppSelector, useAppDispatch } from 'src/store/hooks';
```

If the component has no Redux connection, skip section 1.

## Ant Design React Native

```typescript
import { Button, Modal, Toast } from '@ant-design/react-native';
```

Check if Ant Design covers the need before writing custom logic:

| Task | Correct | Incorrect |
|------|---------|-----------|
| Feedback messages | `Toast.success / Toast.fail` | Custom notification state |
| Loading spinner | `ActivityIndicator` from ADNR | Custom spinner |
| Modal | `Modal` from ADNR | Custom overlay |

## Platform-specific code

For small differences, use `Platform.OS`:
```typescript
import { Platform } from 'react-native';

const shadowStyle = Platform.OS === 'ios'
  ? { shadowColor: '#000', shadowOpacity: 0.1 }
  : { elevation: 2 };
```

For larger platform divergence, use file suffixes:
- `ComponentName.ios.tsx` — iOS-specific implementation
- `ComponentName.android.tsx` — Android-specific implementation

## Exports

Default export from `ComponentName.tsx`, re-exported through `index.ts`.
Named exports (types, hooks) are imported directly from their files when needed.

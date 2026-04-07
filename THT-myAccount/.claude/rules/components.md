# Component rules

## Folder structure

New components must follow this structure:

```
ComponentName/
  index.ts                  ← re-export only
  ComponentName.tsx
  ComponentName.types.ts
  ComponentName.module.scss
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
2. Refs & data hooks — useRef, hooks that read/transform data (useEditor, useFiles, useCompanyList...)
3. useState
4. Plain variables — no memoization
5. useMemo
6. Callbacks & handlers
7. useEffect
8. Event/effect hooks — hooks whose main logic is side effects or event subscriptions (useWindowOnEvent...)
9. Early returns
10. return JSX
```

**The rule for hooks position:** if a hook's primary purpose is reading or transforming data, it goes near the top (after Redux). If its primary purpose is handling events or triggering effects — it goes after `useEffect`, because it depends on handlers and state defined above.

Example:
```typescript
const MyComponent: FC<Props> = ({ id }) => {
  // 1. Redux
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectItems);

  // 2. Refs & data hooks
  const listRef = useRef<HTMLDivElement>(null);
  const { editor, getEditor } = useEditor();

  // 3. State
  const [isOpen, setIsOpen] = useState(false);

  // 4. Plain variables
  const title = items[0]?.name ?? 'Untitled';

  // 5. Memo
  const filteredItems = useMemo(() => items.filter((i) => i.active), [items]);

  // 6. Handlers
  const handleClose = useCallback(() => setIsOpen(false), []);

  // 7. Effects
  useEffect(() => {
    dispatch(loadItems(id));
    return () => dispatch(clearItems());
  }, [id, dispatch]);

  // 8. Event/effect hooks
  useWindowOnEvent('resize', handleResize, [], true);

  // 9. Early returns
  if (!items.length) return null;

  // 10. Render
  return <div ref={listRef}>...</div>;
};
```

## Props typing

Always use `type`, never `interface`. Props live in `ComponentName.types.ts`:

```typescript
// ComponentName.types.ts
type Props = {
  id: number;
  onClose: () => void;
  variant?: 'primary' | 'secondary';
};

export type { Props };
```

When wrapping a native HTML element, extend via intersection:
```typescript
type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'primary' | 'secondary';
};
```

## Subcomponents

Split into a subcomponent when a section of JSX:
- Has its own local state
- Is logically self-contained (a distinct UI section, not just visual grouping)
- Is reused in more than one place

Do **not** split just because JSX is long. A large form where all parts are tightly coupled (shared form instance, cross-field validation) can and should stay as one component. Split when sections are independently meaningful.

Subcomponents go into `components/` and follow the same folder structure.
They are imported by the parent — never the other way around.

## Styles

- CSS Modules (`.module.scss`) for all new components
- Use `classnames` (or `cx` from `classnames`) for conditional classes
- Inline styles only for dynamic CSS values (e.g. `style={{ width: value }}`)
- Do not override Ant Design styles with inline styles — use Less variables

## Redux

Always use typed hooks — never raw `useSelector`/`useDispatch`:
```typescript
import { useAppSelector, useAppDispatch } from 'helpers/hooks/useAppStore';
```

If the component has no Redux connection, skip section 1.

## Ant Design

```typescript
import { Button, Form, Modal } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
```

## Exports

Default export from `ComponentName.tsx`, re-exported through `index.ts`.
Named exports (types, hooks) are imported directly from their files when needed.

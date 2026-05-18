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
1. Redux          — useAppDispatch, useSelector + selectors
2. Refs & data hooks — useRef, hooks that read/transform data
3. useState
4. Plain variables — no memoization
5. useMemo
6. Callbacks & handlers
7. useEffect
8. Event/effect hooks — hooks whose main logic is side effects or event subscriptions
9. Early returns
10. return JSX
```

**The rule for hooks position:** if a hook's primary purpose is reading or transforming data, it goes near the top (after Redux). If its primary purpose is handling events or triggering effects — it goes after `useEffect`.

Example:
```typescript
const MyComponent: FC<Props> = ({ id }) => {
  // 1. Redux
  const dispatch = useAppDispatch();
  const items = useSelector((state: RootState) => state.myDomain.items);

  // 2. Refs & data hooks
  const listRef = useRef<HTMLDivElement>(null);

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
    dispatch({ type: 'LOAD_ITEMS', payload: id });
  }, [id, dispatch]);

  // 8. Early returns
  if (!items.length) return null;

  // 9. Render
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

Do **not** split just because JSX is long. A large form where all parts are tightly coupled can and should stay as one component.

Subcomponents go into `components/` and follow the same folder structure.
They are imported by the parent — never the other way around.

## Styles

- CSS Modules (`.module.scss`) for all new components
- Every `.module.scss` file must start with `@import 'styles/custom/variables'`
- Colors and design tokens must come from `styles/custom/variables.scss`, not hardcoded
- Use `classnames` for conditional classes
- Inline styles only for dynamic CSS values (e.g. `style={{ width: value }}`)
- Do not override Ant Design styles with inline styles — use Less variables

## Redux

Always use typed dispatch — never raw `useDispatch`:
```typescript
import { useAppDispatch } from '@src/hooks/useAppDispatch';
import { useSelector } from 'react-redux';
import type { RootState } from '@src/store/configureStore';
```

If the component has no Redux connection, skip section 1.

## Ant Design v3

```typescript
import { Button, Form, Table, Modal } from 'antd';
import { Icon } from 'antd';
```

Icons use the `Icon` component with a `type` string prop:
```typescript
<Icon type="close" />
<Icon type="check-circle" theme="filled" />
```

Do **not** use `@ant-design/icons` — that package belongs to Ant Design v4+.

Forms use the `Form.create()` HOC pattern:
```typescript
const MyForm = Form.create<Props>()(({ form }: Props) => {
  const { getFieldDecorator } = form;
  return (
    <Form>
      <Form.Item>
        {getFieldDecorator('email', { rules: emailRules() })(
          <Input />
        )}
      </Form.Item>
    </Form>
  );
});
```

### Use built-in Ant Design features first

Before writing custom logic — check if Ant Design already covers it:

| Task | Correct | Incorrect |
|------|---------|-----------|
| Dynamic form fields | `Form` + manual array in state | Custom state + `.map()` |
| Validation | `getFieldDecorator` `rules` | Manual checks in `onChange` |

## Exports

Default export from `ComponentName.tsx`, re-exported through `index.ts`.
Named exports (types, hooks) are imported directly from their files when needed.

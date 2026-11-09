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
  const items = useAppSelector((state) => state.myDomain.items);

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

Do **not** split just because JSX is long. Subcomponents go into `components/` and follow the same folder structure.

## Styles

- CSS Modules (`.module.scss`) for all new components
- Use `classnames` for conditional classes
- Inline styles only for dynamic CSS values (e.g. `style={{ width: value }}`)
- Do not override Ant Design styles with inline styles — use Less variables

## Redux

Always use typed hooks — never raw `useSelector`/`useDispatch`:
```typescript
import { useAppSelector } from 'hooks/useAppSelector';
import useAppDispatch from 'hooks/useAppDispatch';
```

## Ant Design v3

```typescript
import { Button, Form, Table, Icon, Modal } from 'antd';
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

rc-form gives the control rendered by `getFieldDecorator` a `ref` and clears the field value when that ref turns `null`. A function component used as a field control must forward the ref to an element that lives as long as the component — take `ref` as the second argument and export `forwardRef(Component)` (see `templates/SelectSearchAndShowMore`, `templates/EmailEditor`).

### Date and time pickers — `templates/DatePicker`

Never import `DatePicker`, `TimePicker` or `Calendar` from `antd` (ESLint `no-restricted-imports` blocks it).
The app works with `Dayjs` only; the template converts to the moment objects antd 3 needs and back.

```typescript
import DatePicker, { TimePicker } from 'templates/DatePicker';
import dayjs from 'helpers/dayjs';

{getFieldDecorator('invoice_date', { initialValue: dayjs() })(
  <DatePicker disabledDate={disableDate} />
)}
<TimePicker use12Hours format="h:mm:ss A" value={time} onChange={setTime} />
```

- `value` / `defaultValue` are `Dayjs | null`; `onChange(date: Dayjs | null, dateString)`; `disabledDate(current: Dayjs)`.
- Works with `getFieldDecorator` (the template forwards the ref), so form values are `Dayjs`.
- Moment-typed antd props the template does not convert (`dateRender`, `disabledTime`, `onPanelChange`, `onOk`, `defaultPickerValue`, `defaultOpenValue`) are left out of its props type. Add the conversion in the template when one is needed.
- Defaults (format, popup container, locale) are changed in the template, not at call sites.
- When antd is upgraded (sc-40207), only the template internals change and `helpers/momentAdapter.ts` is deleted.

### Use built-in Ant Design features first

Before writing custom logic — check if Ant Design already covers it:

| Task | Correct | Incorrect |
|------|---------|-----------|
| Dynamic form fields | `Form` + manual array in state | Custom state + `.map()` |
| Validation | `getFieldDecorator` `rules` | Manual checks in `onChange` |

## Exports

Default export from `ComponentName.tsx`, re-exported through `index.ts`.
Named exports (types, hooks) are imported directly from their files when needed.

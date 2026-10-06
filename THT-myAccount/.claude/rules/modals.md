# Modal rules

There is **no shared Modal wrapper** in this project. Every modal is a raw Ant Design `<Modal>`,
so the baseline below has to be repeated by hand on each one. Follow it exactly.

Reference implementation: `src/views/CandidateProfile/components/Offers/components/` —
`RevokeOfferModal.tsx`, `SendOfferModal.tsx`, `CountersignOfferModal.tsx`.

---

## Visibility — `useVisibleModal` is mandatory

Whichever component owns the open/close state must use `useVisibleModal`:

```typescript
import { useVisibleModal } from 'helpers/useVisible';

const sendModal = useVisibleModal('offerSend');
// sendModal.visible / .show / .hide / .toggle / .setVisible
```

**Never use `useState` for modal visibility, and never the default `useVisible` export.**

Why: `useVisibleModal` wraps `useVisible` with `useControlOfOpenModal`, which registers the modal
in the `LayoutSettings` slice and toggles the `blockedWindow` class on `<body>`
(`src/views/App/AppComponent.scss:1017` → `overflow: hidden !important`). Plain `useState` renders
the modal correctly but leaves the page scrolling behind it.

The `name` argument is a lowerCamelCase domain identifier — `'offerSend'`, `'offerRevoke'`,
`'automations'`, `'consentToSmsModal'`. One hook call per modal, each assigned to its own
`xxxModal` const:

```typescript
const pdfModal = useVisibleModal('offerPdf');
const revokeModal = useVisibleModal('offerRevoke');
const countersignModal = useVisibleModal('offerCountersign');
```

---

## Mandatory `<Modal>` props

| Prop | Value | Why |
|------|-------|-----|
| `centered` | always | Project baseline — modals are vertically centered, not top-anchored |
| `open` | `open={visible}` | AntD 4.23+ API. **Never** `visible=` — it is deprecated |
| `destroyOnClose` | on any modal with a form or local state | Resets fields between openings |
| `title` | `<Title level={4} style={{ marginBottom: 0 }}>` | See below |
| `onCancel` | wired to the `onClose` prop | Handles ✕, mask click and Esc |

---

## Title

```tsx
import Title from 'antd/lib/typography/Title';

title={
  <Title
    level={4}
    style={{ marginBottom: 0 }}
  >
    Revoke offer?
  </Title>
}
```

- Import via the deep path `antd/lib/typography/Title`, not `const { Title } = Typography`.
- `level={4}` is the baseline for modal titles.
- `style={{ marginBottom: 0 }}` is a **sanctioned exception** to the "inline styles only for
  dynamic values" rule in [components.md](components.md) — the AntD `Title` bottom margin has to
  be cancelled, and this is the established form. Do not invent a `.module.scss` class for it.

---

## Props contract

```typescript
// XxxModal.types.ts
type Props = {
  visible: boolean;
  onClose: () => void;
  // + domain props
};

export type { Props };
```

The parent wires it from the hook:

```tsx
<RevokeOfferModal
  offer={offer}
  candidateId={candidateId}
  visible={revokeModal.visible}
  onClose={revokeModal.hide}
/>
```

A modal that renders its **own trigger** takes no visibility props and calls `useVisibleModal`
internally — see `src/views/JobPost/components/Automations/components/AutomationsModal.tsx`.

---

## Loading discipline

While a request is in flight, the modal must be locked. This is the most consistently applied
rule in the codebase:

```tsx
closable={!loading}
maskClosable={!loading}
okButtonProps={{ loading }}
cancelButtonProps={{ disabled: loading }}
onCancel={loading ? undefined : onClose}
```

The `onCancel` guard is what blocks Esc: AntD calls `onCancel` on Esc even when `closable` and
`maskClosable` are `false`. Do **not** reach for `keyboard={!loading}` instead — with `keyboard`
off rc-dialog no longer stops the keydown, so the Esc bubbles to a parent `Drawer` (the candidate
preview) and closes it, unmounting the modal while the request is still running.

Use whatever the domain hook exposes (`isMutating`, `saving`, `loading`) — don't add a second
local flag for the UI. A request-level double-submit guard is a different thing: the Redux flag
only flips after the thunk's `pending` action, so two clicks a few milliseconds apart both get
through. Guard the handler with a ref set before the first `await`
(`src/views/BlockCandidateModal/BlockCandidateModal.tsx`):

```tsx
const submittingRef = useRef(false);

const handleSubmit = async () => {
  if (submittingRef.current) {
    return;
  }
  submittingRef.current = true;
  try {
    const values = await form.validateFields();
    …
  } finally {
    submittingRef.current = false;
  }
};
```

---

## Footer

Three sanctioned patterns. Cancel is always on the left, primary/destructive on the right.

**1. AntD default footer** — for confirm dialogs and simple forms:

```tsx
okText="Revoke"
cancelText="Cancel"
okButtonProps={{ loading: isMutating }}
cancelButtonProps={{ disabled: isMutating }}
onOk={handleSubmit}
onCancel={onClose}
```

Destructive action:
```tsx
okButtonProps={{ danger: true, type: 'default', loading: isMutating }}
```

Hiding Cancel on an info-only modal:
```tsx
cancelButtonProps={{ style: { display: 'none' } }}
```

**2. `footer={null}`** — the form owns its own submit row in a trailing `Form.Item`:

```tsx
<Form.Item>
  <ElementsBox
    justifyContent="flex-end"
    sizeGap={8}
  >
    <Button
      disabled={saving}
      onClick={onCancel}
    >
      Cancel
    </Button>
    <Button
      type="primary"
      htmlType="submit"
      loading={saving}
    >
      Save
    </Button>
  </ElementsBox>
</Form.Item>
```

**3. Custom `footer`** — when buttons are conditional (permissions, read-only state):

```tsx
footer={
  <ElementsBox
    justifyContent="flex-end"
    sizeGap={10}
  >
    <Button onClick={onClose}>Cancel</Button>
    {!readOnly && (
      <Button
        type="primary"
        loading={saving}
        onClick={handleSave}
      >
        Save
      </Button>
    )}
  </ElementsBox>
}
```

Use `ElementsBox` from `templates/ElementsBox` for the button row — never a raw `<div>` with
flex styles, per [components.md](components.md).

---

## Width

| Case | Value |
|------|-------|
| Confirm / short form | omit — AntD default is 520 |
| Standard form | `width={600}` |
| Wide content (tables, previews) | `width={820}` / `width={900}` |
| Responsive | `width="100%"` + `style={{ maxWidth: 800 }}` |

---

## Forms in modals

- `const [form] = Form.useForm<FormValues>();`
- `layout="vertical"`
- Validation rules come from `helpers/rulesFields.ts` — never write rules inline.
  If the rule doesn't exist yet, add it there.
- `Form.useWatch('field', form)` for reactive reads.
- Submit from `onOk`:

```typescript
const handleSubmit = async () => {
  try {
    const values = await form.validateFields();
    const ok = await saveSomething(values);
    if (ok) {
      form.resetFields();
      onClose();
    }
  } catch {
    // validation errors are surfaced inline by AntD
  }
};
```

---

## Folder structure

Per [components.md](components.md):

```
XxxModal/
  index.ts                 ← re-export only
  XxxModal.tsx
  XxxModal.types.ts
  XxxModal.module.scss     ← only if it needs styles
```

Placement:
- Belongs to one feature → `views/<Feature>/components/XxxModal/`
- Is the whole feature → `views/XxxModal/`
- Reusable and presentational, no Redux → `templates/XxxModal/`

Naming: `<Domain>Modal` (suffix). The older `Modal<Domain>` prefix form is legacy — do not
follow it in new code.

---

## Template

`XxxModal.types.ts`
```typescript
type Props = {
  visible: boolean;
  onClose: () => void;
};

export type { Props };
```

`XxxModal.tsx`
```tsx
import React, { FC } from 'react';
import { Form, Input, Modal } from 'antd';
import Title from 'antd/lib/typography/Title';

import { getRequiredTextRules } from 'helpers/rulesFields';
import { useXxxActions } from 'store/slices/xxx';

import { Props } from './XxxModal.types';

type FormValues = {
  name: string;
};

const XxxModal: FC<Props> = ({ visible, onClose }) => {
  const { saveXxx, isMutating } = useXxxActions();
  const [form] = Form.useForm<FormValues>();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const ok = await saveXxx(values);
      if (ok) {
        form.resetFields();
        onClose();
      }
    } catch {
      // validation errors are surfaced inline
    }
  };

  return (
    <Modal
      centered
      destroyOnClose
      open={visible}
      title={
        <Title
          level={4}
          style={{ marginBottom: 0 }}
        >
          Modal title
        </Title>
      }
      okText="Save"
      cancelText="Cancel"
      closable={!isMutating}
      maskClosable={!isMutating}
      okButtonProps={{ loading: isMutating }}
      cancelButtonProps={{ disabled: isMutating }}
      width={600}
      onOk={handleSubmit}
      onCancel={onClose}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="Name"
          name="name"
          rules={getRequiredTextRules('Name', 100)}
        >
          <Input placeholder="Enter name" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default XxxModal;
```

`index.ts`
```typescript
export { default } from './XxxModal';
```

`XxxModal.module.scss` — only if needed:
```scss
@import 'assets/styles/custom/variables';

.description {
  margin-bottom: 16px;
  color: $gray-800;
}
```

Parent:
```tsx
const xxxModal = useVisibleModal('xxx');

<Button onClick={xxxModal.show}>Open</Button>

<XxxModal
  visible={xxxModal.visible}
  onClose={xxxModal.hide}
/>
```

Formatting note: one JSX attribute per line — the project's `.prettierrc` sets
`singleAttributePerLine: true`.

---

## Do not

- Pass `visible=` to `<Modal>` — use `open=`
- Use `useState` or the default `useVisible` for modal visibility — use `useVisibleModal`
- Write `visable` — it is a typo that exists in `PromoModal` and `SequenceModal`, do not spread it
- Declare `interface Props` — always `type`
- Build the footer button row with a raw flex `<div>` — use `ElementsBox`
- Re-add modal header/footer borders — `AppComponent.scss:1105-1141` strips them project-wide
  and sets the body/header/footer padding
- Hardcode colors or spacing — take them from `assets/styles/custom/variables`
- Override AntD modal styles inline — use a `.module.scss` class with `:global(.ant-modal-…)`

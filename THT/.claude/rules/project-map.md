# Project Map — THT

Детальна довідка по кожному підпроекту. Читати при плануванні задачі або тестуванні.

---

## THT-myAccount — Особистий кабінет клієнта

**Роль:** Веб-застосунок для клієнтів компанії — перегляд та редагування власного профілю, робота з оцінками, документи, налаштування.

**Стек:**
- React 18.2 + TypeScript 4.7.4 (strict)
- Redux: змішаний — legacy (`redux` + `redux-thunk`) + RTK (`@reduxjs/toolkit`). Новий код — тільки RTK
- Ant Design 4.24.7 + Less theming
- React Router v5 (централізований `routeItems`)
- Axios через `helpers/ClientApi`

**Dev:** `yarn start` → `localhost:3000`

**Ключові директорії:**
```
src/
  components/     загальні компоненти
  views/          секції/блоки сторінок
  pages/          сторінки (роутінг через routeItems)
  store/
    slices/       RTK слайси (нові)
    actions/      legacy actions
    reducers/     legacy switch-case reducers
  helpers/        ClientApi, утіліти, хуки
```

**Особливості:**
- Auth via `runWithCompanyGroupId` / `runWithAccessData` в thunk'ах
- `useAppSelector` / `useAppDispatch` з `helpers/hooks/useAppStore`
- Маршрути: `ROUTER_ITEMS` константа, `billingPermission` для перевірки підписки

---

## THT-management — Адмінка / менеджмент

**Роль:** Внутрішній інструмент для HR/менеджерів — управління кандидатами, оцінками, групами, звітами.

**Стек:**
- React 18.2 + TypeScript 3.7.5 (strict)
- Redux: **тільки legacy** (`redux` + `redux-thunk`). RTK заборонено
- Ant Design 3.26.5 + `Form.create()` HOC
- React Router v5 (централізований `src/pages/routeItems.js`)
- Axios через `helpers/ClientApi` (JS файл)

**Dev:** `yarn start` → `localhost:3030` (або `node ./server/app.js` для prod-режиму)

**Ключові директорії:**
```
src/
  actions/        redux-thunk action creators
  reducers/       switch-case reducers
  store/
    slices/       legacy pattern — switch-case, НЕ RTK
  pages/          сторінки + routeItems.js
  helpers/        ClientApi (JS), утіліти
```

**Особливості:**
- `USER_IS_AUTH` / `USER_IS_NOT_AUTH` / `USER_IS_ADMIN` — константи прав доступу
- Ant Design 3: іконки через `Icon` компонент, `Form.create()` замість хуків
- Немає `@reduxjs/toolkit` — не додавати

---

## THT-applicant — Апліканська частина

**Роль:** Публічна частина — форми для кандидатів, проходження оцінок, тести.

**Стек:**
- Next.js 13.0.5 + React 18.2 + TypeScript 4.9.3 (strict)
- Redux: **тільки legacy** (`redux` + `redux-thunk` + `next-redux-wrapper`)
- Ant Design 3.26.5 + `Form.create()` HOC
- SSR через `getServerSideProps` + `wrapper.getServerSideProps`
- Path aliases: `@src/`, `@components/`, `@styles/`, `@pages/`, `@public/`

**Dev:** `yarn dev` → `localhost:3080`

**Ключові директорії:**
```
src/ або pages/
  pages/          Next.js file-based routing
  actions/        redux-thunk action creators
  reducers/       switch-case reducers
  store/
    configureStore.ts   з HYDRATE для SSR
    slices/             legacy — switch-case
  selectors/      reselect selectors
  helpers/        ClientApi (JS), утіліти
```

**Особливості:**
- SSR — `store.dispatch` може відбуватись на сервері
- Немає `routeItems.js` — маршрути через Next.js файлову структуру
- Немає `@reduxjs/toolkit` — не додавати

---

## THT-mobile-app — Мобільний застосунок

**Роль:** iOS/Android застосунок — мобільна версія особистого кабінету клієнта.

**Стек:**
- React Native 0.81.5 + Expo 54 + TypeScript 5.9.2 (strict)
- Redux: **тільки RTK** (`@reduxjs/toolkit` 2.10.1). Legacy заборонено
- Ant Design React Native 5.4.3
- Expo Router 6 — file-based routing в `app/`
- Axios через `src/api/axios.ts`

**Dev:** `npx expo start` (або `yarn start`) → обирати iOS/Android/Web в консолі

**Path aliases:**
- `@components` → `src/components`
- `@screens` → `src/screens`
- `@icons` → `src/components/icons`

**Ключові директорії:**
```
app/            Expo Router маршрути (file-based)
src/
  components/   загальні компоненти
  screens/      екрани
  store/
    slices/     RTK слайси
  api/          axios instance + domain API functions
  helpers/      утіліти
```

**Особливості:**
- Стилі тільки через `StyleSheet.create()`, не CSS Modules
- Умовні стилі: масиви `[styles.base, isActive && styles.active]`
- Auth: `runWithAccessData(getState, callback)` в RTK thunk'ах

---

## THT-html-reports — Переглядач звітів

**Роль:** Сервер для відображення HTML звітів оцінювання. Два типи звітів: base та new.

**Стек:** Node.js + Express (або схожий) сервер, React build для фронту

**Dev:** `node ./server/app.js` → `localhost:8080`

**Збірка:** `yarn build` — збирає `base-reports/` та `new-reports/` React застосунки

---

## Crosslinks між проектами

| Проект | Що пов'язано |
|---|---|
| myAccount ↔ mobile-app | Однаковий бізнес-домен, схожий UX, обидва RTK |
| management | Адмін-частина, яка керує даними що бачить applicant та myAccount |
| applicant | Публічна частина — окремий домен, legacy Redux |
| html-reports | Рендерить PDF/HTML звіти що генеруються в management/myAccount |

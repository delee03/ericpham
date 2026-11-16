# AGENTS.md

> Map for AI coding agents (Claude Code, Codex, Cursor, Copilot, etc.) working on this
> repository. Read top-to-bottom before making any change. Keep this file in sync with
> reality — if you discover something undocumented while working, add it here.

## Project

Personal developer portfolio for **Phạm Tiến Thuận Phát** (English name: Eric).
The homepage is a scroll-driven "zoom-out journey" (desk → Saigon → Earth →
planets → Pale Blue Dot → Milky Way → cosmic web → back to the desk and the
contact form). `/plain` holds the same content as a plain scrollable page and
`/blog` lists dev.to articles. Deployed by merging to `main` (Vercel and
Netlify both build from it).

Repository: `git@github.com:delee03/ericpham.git` (formerly `fuderrdev`)
Default branch: `main`

## Stack

- **Next.js 15.5.18** (App Router) — pinned for CVE remediation, do not downgrade
- **React 19.0.0**
- **Tailwind CSS 3** + a small `app/css/globals.scss`
- **three.js + React Three Fiber + drei + postprocessing**, **Lenis** for the journey
- **ESLint** via `next lint` (no flat config; uses `.eslintrc.json`)
- **Nodemailer** for the contact form (Gmail SMTP)
- `.npmrc` sets `legacy-peer-deps=true`; clean installs fail without it
- **No test runner is configured** — verification is `npm run lint` and `npm run build`

## The map — where to make changes

### Content (most edits go here)

All content is data-driven from JS modules under `utils/data/`. Both the journey
and the plain page read from them, so one edit updates both.

| Content                                              | File                           | Notes                                                        |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Name, photo, role, summary, social links, resume URL | `utils/data/personal-data.js`  | Single source of truth for personal info                     |
| Journey levels, captions, hero copy, flyby projects  | `utils/data/journey.js`        | One entry per scale level, in scroll order                   |
| Experience cards                                     | `utils/data/experience.js`     | Most recent first; the first entry is shown as current       |
| Education + certificates                             | `utils/data/educations.js`     | Single list, reverse-chronological                           |
| Skills                                               | `utils/data/skills.js`         | `skillGroups`, rendered as text                              |
| Projects                                             | `utils/data/projects-data.js`  | Most recent first; `code`/`demo` links render when non-empty |
| Contact details                                      | `utils/data/contactsData.js`   | Email + socials                                              |
| Page `<title>` and description                       | `app/layout.js`                | `metadata` export                                            |

### Pages and components

```
app/
├── layout.js            # fonts, metadata; renders no chrome
├── page.js              # homepage (the journey)
├── plain/page.js        # all content, no 3D; skip target and fallback
├── blog/page.js         # dev.to articles
├── not-found.jsx
├── api/contact/route.js # POST: contact form → Nodemailer (+ optional Telegram)
└── components/
    └── site/            # shared chrome: header, footer, panel, section,
                         # blog card, contact form
utils/blog.js            # dev.to fetch (cached 1h, never throws)
scripts/generate-ambient.py  # regenerates the journey's ambient track
```

### Design tokens

Defined in `tailwind.config.js`: colours `void`, `ink`, `soft`, `muted`, `dim`,
`sky`, `gold`, `line`, `field`, `panel`; fonts `font-display` (Space Grotesk),
`font-sans` (Inter), `font-mono` (JetBrains Mono). Fonts load in `app/layout.js`
with the Vietnamese subset — keep it, the name needs those glyphs.

### Static assets

| Path                          | What it is                                             |
| ----------------------------- | ------------------------------------------------------ |
| `public/profile.png`          | Current avatar — replace this file to update the photo |
| `public/profile_fallback.png` | Original avatar — recovery copy, **do not delete**     |
| `public/audio/ambient.m4a`    | 42 s ambient track for the journey's auto-play mode    |
| `app/favicon.ico`             | Site favicon                                           |

## Common tasks

### Update content (new project, new cert, change role, etc.)

1. Edit the relevant `utils/data/*.js` file.
2. `npm run lint` — must be clean.
3. Commit with a conventional-commit subject.
4. Open a PR and merge it to `main` (rebase merge, atomic commits).

### Bump a dependency for a CVE

1. `npm install <pkg>@<patched-version>` (or `npm audit fix` for non-breaking).
2. `npm run build` must succeed end-to-end.
3. Commit: `chore(deps): bump <pkg> to <version> for <CVE-id-or-reason>`.

### Contact form environment

`.env.example` lists the variables. `EMAIL_ADDRESS` and `GMAIL_PASSKEY` (a Gmail
app password) are required; the Telegram pair is optional and best-effort.

## Conventions

- Work on a branch and merge through a PR with `gh pr merge --rebase`, keeping
  commits atomic. Direct pushes to `main` are fine only for tiny content tweaks.
- Match the surrounding file. JSX (`.jsx`) and `.js` modules, no TypeScript.
- Tailwind utility classes inline; use the design tokens rather than raw hex.
- Do not introduce a separate ESLint config.

### Verification

```bash
npm run dev      # local preview at http://localhost:3000
npm run lint     # required before commit
npm run build    # required after dep bumps or component changes
```

## Gotchas

### 1. Branding name: "Thuận Phát" first, "Eric" as the English name

- **Primary name everywhere (header, hero, footer):** "Thuận Phát"; the full
  form is "Phạm Tiến Thuận Phát" (`personalData.fullName`).
- **"Eric"** is the English name (`personalData.englishName`). Show it as a
  secondary label next to the Vietnamese name (e.g. "English name: Eric"), never
  as a replacement, so it is clear both names are the same person.

### 2. Social usernames are split between real accounts

- `ericpham03` — Facebook, X/Twitter, dev.to
- `fuderrpham` / `fuderr-pham` — StackOverflow, LeetCode (legacy names that are
  still real, working URLs — **do not rename**)
- `delee03` — GitHub username (do not change)

### 3. The dev.to key is `devUserName`

`personalData.devUserName` (capital N). A typo here once made the blog query
dev.to as `username=undefined`. Use `getBlogs()` from `utils/blog.js` instead of
fetching directly.

### 4. Content must exist on the plain page too

`/plain` is the fallback for reduced-motion users and browsers without WebGL,
and the page recruiters skim. Anything added to the journey must also appear
there.

## Don'ts

- Don't delete `public/profile_fallback.png` (recovery copy).
- Don't rename or remove existing social usernames (they're real accounts).
- Don't downgrade Next.js below `15.5.18` (CVE remediation; see commit `66490b5`).
- Don't add a test runner without asking the maintainer first.
- Don't introduce a separate ESLint config — `next lint` handles everything.
- Don't reformat unrelated files when making a small content change.

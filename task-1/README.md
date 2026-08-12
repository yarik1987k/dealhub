# DealHub — Case Study Tabs

A custom WordPress theme implementing the "Loved. Adopted. Trusted." case-study section as an
ACF Gutenberg block: client logo tabs, quote, solution and CRM badges, headline stats and a
testimonial video. The tabs become a swipeable slider on mobile.

## Running it — import the LocalWP site

`task.zip` (41 MB) is a full [Local](https://localwp.com) export of the site: WordPress 7.0,
ACF Pro, the theme, the database and all content. Importing it gives you the finished page with
nothing left to configure.

1. Download `task.zip` from this folder.
2. Open Local → **File → Import Site** (or drag the zip onto the Local window).
3. Start the site and open it. Admin is at `/wp-admin`, user `admin` — password supplied with
   the submission message.

The export was made with Local 9.2.8 (PHP 8.2, MySQL 8.0, nginx). Local rewrites the site domain
on import, so the `task.local` URL in the export does not have to be free on your machine.

## Reviewing the code without importing

The theme source is also committed unzipped, in [`dealhub/`](dealhub), so it can be read and
diffed on GitHub without downloading 41 MB. It is the same code that is inside the zip, at
`app/public/wp-content/themes/dealhub/`.

To use it against an existing WordPress install instead of the export:

```
cp -R dealhub /path/to/wp-content/themes/
```

Then activate **DealHub** in Appearance → Themes. Requires WordPress 6.0+, PHP 8.0+ and
**Advanced Custom Fields Pro** (the section is an ACF block). There is no build step. Activating
the theme on a fresh install seeds a homepage that already matches the design, so the section can
be reviewed without first creating a page, uploading eleven images and filling in five repeater
rows by hand. The import runs once, is guarded by an option, and never overwrites existing
content — see `inc/demo-content.php`, which is safe to delete along with its `require` in
`functions.php`.

## Layout

```
dealhub/
├── blocks/case-study-tabs/     block.json, render.php, style.css, editor.css, view.js
├── acf-json/                   field group, version-controlled with the theme
├── assets/css/                 tokens.css, base.css, fonts.css, editor.css
├── assets/demo/                images used by the demo import
├── assets/fonts/               DM Sans, Caveat (variable woff2)
└── inc/                        setup, assets, helpers, acf, blocks, demo-content
```

Notes on a few decisions:

- **Blocks register from `block.json`**, not `acf_register_block_type()`. That is ACF's current
  recommended path, and it means `style` and `viewScript` load only on pages that actually contain
  the block, the inserter gets a real preview, and adding a second block needs no PHP changes —
  `inc/blocks.php` registers every directory under `/blocks` holding a manifest.
- **ACF field groups live in `acf-json/`**, so the field configuration travels with the theme
  instead of existing only in a database. Editing a group in wp-admin rewrites the JSON.
- **`style.css` is intentionally empty** beyond the theme header. Styles are split into global
  tokens/reset and per-block stylesheets, so no page loads CSS for a block it does not render.
- **No raw hex values in block CSS** — colours and spacing come from `tokens.css`.

## Note on the export

`task.zip` is the Local export as produced, so it also carries WordPress core, the ACF and ACF Pro
plugins, `wp-config.php`, the LocalWP service config and the site database dump. It is included
whole so the site can be imported in one step.

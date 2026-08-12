# DealHub — Case Study Tabs

A custom WordPress theme implementing the "Loved. Adopted. Trusted." case-study section as an
ACF Gutenberg block: client logo tabs, quote, solution and CRM badges, headline stats and a
testimonial video. The tabs become a swipeable slider on mobile.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- **Advanced Custom Fields Pro** — the block is an ACF block, registered from `block.json`

## Installing

```
cp -R dealhub /path/to/wp-content/themes/
```

Then activate **DealHub** in Appearance → Themes. Nothing else to do: there is no build step, and
activating the theme seeds a homepage that already matches the design, so the section can be
reviewed without first creating a page, uploading eleven images and filling in five repeater rows
by hand. The import runs once, is guarded by an option, and never overwrites existing content —
see `inc/demo-content.php`, which is safe to delete along with its `require` in `functions.php`.

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

## Not included in this repo

The task was delivered as a LocalWP export (5,487 files, 131 MB). Only the theme is here. Left out:

- WordPress core
- Advanced Custom Fields / ACF Pro — third-party commercial plugin code, not mine to redistribute
- `app/sql/local.sql` — the site database dump, which carries user password hashes
- `wp-config.php`, `local-site.json`, `conf/`, `logs/` — local environment config and credentials

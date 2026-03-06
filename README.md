# adowiki-to-mkdocs

[![npm version](https://img.shields.io/npm/v/adowiki-to-mkdocs.svg)](https://www.npmjs.com/package/adowiki-to-mkdocs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CLI to convert an **Azure DevOps project wiki** (Git repo) into an **MkDocs** site. Preserves page order from `.order` files, copies `.attachments` and `.images`, and generates `mkdocs.yml` with the Material theme and navigation.indexes.

## Requirements

- Node.js >= 18
- (Optional) [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) and Python to build/serve the generated site

## Install

**Run without installing (npx):**

```bash
npx adowiki-to-mkdocs --input <wiki-repo> --output <dir> --site-name "<name>" [options]
```

**Install globally:**

```bash
npm install -g adowiki-to-mkdocs
adowiki-to-mkdocs --input <wiki-repo> --output <dir> --site-name "<name>" [options]
```

**Install as a project dependency:**

```bash
npm install adowiki-to-mkdocs
npx adowiki-to-mkdocs --input <wiki-repo> --output <dir> --site-name "<name>" [options]
```

## Usage

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--input` | Yes | Path to the ADO wiki repo root (folder with `.order`, `.attachments`, and page files). |
| `--output` | Yes | Directory where `docs/` and `mkdocs.yml` will be created. |
| `--site-name` | Yes | Value for `site_name` in `mkdocs.yml`. |
| `--page` | No | If set, only include this page and its subpages (by name from `.order`). |
| `--do-not-exclude-folder` | No | Add a folder to `exclude_docs` with `!` so MkDocs keeps it. Can be repeated. |
| `--plugin` | No | Add a plugin to `mkdocs.yml` (e.g. `search`). Can be repeated. |

### Examples

Full wiki:

```bash
adowiki-to-mkdocs --input ./test-data/test-project.wiki --output ./out --site-name "My Wiki"
```

Single page and subpages:

```bash
adowiki-to-mkdocs --input ./test-data/test-project.wiki --output ./out --site-name "My Wiki" --page "Project-details"
```

With plugins and extra folders kept:

```bash
adowiki-to-mkdocs --input ./wiki --output ./site --site-name "Docs" --plugin search --do-not-exclude-folder .attachments
```

## What it does

- Reads **`.order`** at the wiki root and in each folder to determine page order.
- **Copies** all page content (`.md` and folder structure) into `output/docs/`, excluding `.order`. For a page that has subpages, the parent page content is written as `Folder/index.md` (section index).
- Copies **`.attachments`** into `docs/.attachments/`. With `--page`, only attachment files referenced in the included markdown are copied.
- Copies **`.images`** next to each page folder so relative image links work.
- Generates **`docs/index.md`** as a list of top-level pages (with links) and adds it to the nav as Home.
- Generates **`mkdocs.yml`** with Material theme, `navigation.indexes`, and `exclude_docs` so `.attachments` and `.images` are included in the MkDocs build.

Markdown is copied as-is; no link rewriting. Links to `/.attachments/...` and `.images/...` work when `.attachments` and `.images` are under `docs/`.

## Serve the result with MkDocs

Using Docker (Material theme):

```bash
docker run --rm -p 8000:8000 -v "$(pwd)/out:/docs" squidfunk/mkdocs-material serve -a 0.0.0.0:8000
```

Then open http://localhost:8000.

With a local MkDocs install:

```bash
cd out && mkdocs serve
```

## ADO wiki structure

Expects the [Azure DevOps wiki Git layout](https://learn.microsoft.com/en-us/azure/devops/project/wiki/wiki-file-structure): root `.order`, `.attachments/`, and for each page either `Page-Name.md` and/or `Page-Name/` (folder with subpages and its own `.order`). Page folders can contain `.images/` for local images.

---

## Development

For contributors who want to build and run from source.

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/USER/adowiki-to-mkdocs.git
   cd adowiki-to-mkdocs
   npm install
   ```

2. Build the CLI:

   ```bash
   npm run build
   ```

   Output is in `dist/`. Run with `node dist/cli.js ...` or `npm start -- ...`.

3. Run without building (development):

   ```bash
   npm run dev -- --input <wiki-repo> --output <dir> --site-name "<name>"
   ```

**Scripts:**

| Script | Description |
|--------|-------------|
| `npm run build` | Bundle the CLI to `dist/` with tsup. |
| `npm run start` | Run the built CLI: `node dist/cli.js`. |
| `npm run dev` | Run the CLI with tsx (no build step). |

Project layout: `src/` contains the CLI entry (`cli.ts`), tree/order logic (`order.ts`), filtering (`filter.ts`), file copy and attachments (`copy.ts`, `attachments.ts`), nav generation (`nav.ts`), index and mkdocs config (`index-md.ts`, `mkdocs-config.ts`), and shared types (`types.ts`).

---

## License

[MIT](LICENSE)

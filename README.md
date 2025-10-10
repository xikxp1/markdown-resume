<h1 align="center">Markdown Resume</h1>

<p align="center">Write an ATS-friendly Resume in Markdown. Available for anyone, Optimized for Dev.</p>

<p align="center"><a href="https://md-resume.xikxp1.dev/"><strong>Start Writing Now</strong></a>!</p>

<img align="center" src="docs/assets/markdown-resume-screenshot-00.jpg"/>

## Notice

Highly recommend using Chromium-based browsers, e.g., [Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge).

## Features

- Write your resume in Markdown and preview it in real-time, it's smooth!
- It works offline ([PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps))
- Export to A4 and US Letter size PDFs
- Customize page margins, theme colors, line heights, fonts, etc.
- Pick any fonts from [Google Fonts](https://fonts.google.com/)
- Add icons easily via [Iconify](https://github.com/iconify/iconify) (search for icons on [Icônes](https://icones.js.org/))
- Tex support ([KaTeX](https://github.com/KaTeX/KaTeX))
- Cross-reference (would be useful for an academic CV)
- Case correction (e.g. `Github` -> `GitHub`)
- Add line breaks (`\\[10px]`) or start a new page (`\newpage`) just like in LaTeX
- Break pages automatically
- Customize CSS
- Manage multiple resumes
- Your data in your hands:
  - Data are saved locally within your browser, see [here](https://localforage.github.io/localForage/) for details
  - Open-source static website hosted on [Github Pages](https://pages.github.com/), which doesn't (have the ability to) collect your data
  - No user tracking, no ads
- Autosave
- Version history and rollback
- Github sync
- Dark mode

## Development

It's built on [Nuxt 3](https://nuxt.com), with the power of [Vue 3](https://github.com/vuejs/vue-next), [Vite](https://github.com/vitejs/vite), [Zag](https://zagjs.com/), and [UnoCSS](https://github.com/antfu/unocss).

Clone the repo and install dependencies:

```bash
pnpm install
```

Build some [packages](packages):

```bash
pnpm build:pkg
```

Start developing / building the site:

```bash
pnpm dev
pnpm build
```

## Configuration

### Google Fonts

To enable picking fonts from [Google Fonts](https://fonts.google.com/), you will need to generate a [Google Fonts Developer API Key](https://developers.google.com/fonts/docs/developer_api#APIKey). Then, create a `.env` file in [`site`](site/) folder and put:

```
NUXT_PUBLIC_GOOGLE_FONTS_KEY="YOUR_API_KEY"
```

### Auto-save Debounce

By default, auto-save triggers 3000ms (3 seconds) after the last edit. You can customize this by setting the `NUXT_PUBLIC_AUTOSAVE_DEBOUNCE_MS` environment variable:

```
NUXT_PUBLIC_AUTOSAVE_DEBOUNCE_MS=5000
```

Or modify the default value directly in [`site/nuxt.config.ts`](site/nuxt.config.ts):

```typescript
runtimeConfig: {
  public: {
    autosaveDebounceMs: 3000  // Change this value
  }
}
```

### Version History

By default, the system keeps up to 200 versions per resume and automatically deduplicates identical saves. You can customize these settings via environment variables:

```
NUXT_PUBLIC_VERSION_HISTORY_MAX=100
NUXT_PUBLIC_VERSION_HISTORY_DEDUPE=false
```

Or modify the defaults in [`site/nuxt.config.ts`](site/nuxt.config.ts):

```typescript
runtimeConfig: {
  public: {
    versionHistoryMax: 200,        // Maximum versions to keep per resume
    versionHistoryDedupe: true     // Enable deduplication
  }
}
```

## Credits

- Forked from [Renovamen/markdown-resume](https://github.com/Renovamen/markdown-resume)
- The original work: [Renovamen/oh-my-cv](https://github.com/Renovamen/oh-my-cv)
- [billryan/resume](https://github.com/billryan/resume)

## License

This project is licensed under [MIT](LICENSE) license.

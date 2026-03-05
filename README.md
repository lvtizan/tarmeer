# Tarmeer 4.0

Interior design & build website for the UAE. Built in the `tarmeer-4.0` folder under 迪拜网站 (iCloud).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages（对外访问）

代码推送到 `main` 后，GitHub Actions 会自动构建并部署到 GitHub Pages。

- **访问地址**：https://lvtizan.github.io/tarmeer/
- **首次使用**：在仓库 **Settings → Pages** 里，Source 选 **GitHub Actions**，保存后等一次 push 或手动运行 workflow 即可发布。
- 若仓库已用同一分支发布过 Pages，可忽略；新仓库需在 Settings → Pages 里选 “Deploy from a branch” 或 “GitHub Actions” 一次。

## Features (current)

- **Homepage**: Banner, pricing section (two packages, Havenly-style cards), designers grid (circular avatars), company/contact block
- **Footer**: Address with Google Maps link, WhatsApp +971 58 838 8922
- **Nav**: Home, Designers, Pricing, Materials, Become a Partner, Contact Us (WhatsApp)
- **Responsive**: Mobile-first; breakpoints `sm`, `md`, `lg` used throughout
- Placeholder pages: `/designers`, `/designers/:slug`, `/designers/apply`, `/materials`

## Design

- Imagery: high-end, atmospheric (Unsplash placeholders; replace with final assets)
- Pricing module: reference user-provided Havenly-style “Our Design Packages” (section title, tagline, two white cards on warm background, CTA buttons)
- Full plan: see project plan in Cursor (tarmeer-4.0 site replan)

# Putting your portfolio live

This folder is the complete website. It needs no installation and no build step.

## Option A: replace your current Vercel site (keeps ritish-portfolio-rho.vercel.app)
1. Sign in at vercel.com and open your existing portfolio project.
2. If the project is connected to GitHub: open the repository on github.com,
   delete the old files, then drag every file and folder from this folder into
   the repository page ("Add file" → "Upload files") and click "Commit changes".
   Vercel publishes the new version automatically within a minute.
3. If it was uploaded by hand: run `npx vercel --prod` inside this folder,
   or use Option B and point your domain at the new project.

## Option B: a fresh project, no GitHub needed (simplest)
1. Go to vercel.com/new and choose "Deploy" with no Git repository, or install the
   Vercel CLI: open Terminal in this folder and type `npx vercel` then `npx vercel --prod`.
2. Follow the prompts (accept the defaults). You get a live link at the end.
3. Optional: in the project's Settings → Domains, add your own domain.

## Changing things later
- Text lives in `index.html`, `archive.html` and the pages in `work/`.
- Images are in `assets/img` (each image exists in several sizes).
- Easiest: ask Claude for the change and re-upload the updated folder.

## What's inside
- `index.html` home page · `archive.html` the index · `work/` five case studies
- `assets/css`, `assets/js` styles and motion · `assets/vendor` GSAP + Lenis
- `assets/fonts` Instrument Sans and Instrument Serif (SIL Open Font License), self-hosted
- `vercel.json` caching and clean URLs

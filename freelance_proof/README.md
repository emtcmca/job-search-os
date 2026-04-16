# Eric Tetzlaff Freelance Proof Site

Static HTML/CSS portfolio site for operations, workflow, automation, and HOA / condo / property management consulting proof.

Production URL: `https://etetzlaff.vercel.app`

## Public Routes

- `/`
- `/workflow-audit-brief.html`
- `/sop-sprint-brief.html`
- `/hoa-operations-brief.html`
- `/systems-transition-brief.html`

## Local Preview

Run a simple static server from this folder:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/
```

## Vercel Setup

This is a static-first site. Use the project root as the Vercel root directory.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: leave empty
- Install command: leave empty

The `.vercelignore` file excludes local screenshots, archived drafts, and superseded draft pages from deployment.

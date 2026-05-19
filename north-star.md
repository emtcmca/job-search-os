# Eric Tetzlaff — North Star
## Project Knowledge Base · Living Document · Last Updated May 2026

---

## WHO HE IS

Eric Tetzlaff is an AI systems architect and founder-operator who builds production-grade document intelligence systems for high-stakes environments. He is not a career technologist who discovered operations. He is a career operator who discovered that the problems he had been solving manually for fourteen years had names — retrieval, hierarchy resolution, authority ranking, confidence scoring — and that the right tools had finally arrived to solve them properly.

He is the founder of **BoardPath**, a governance intelligence platform for HOA and condominium boards, and **Auris Intelligence**, a forensic legal document intelligence platform in active production use by a midsize regional corporate law firm for civil litigation defense preparation.

He is currently targeting senior AI engineer, AI architect, and Head of AI roles at Series A–C remote-first companies. Target compensation: $130K–$180K base + equity.

**GitHub:** emtcmca
**Portfolio:** erictetzlaff.com
**Email:** eric@erictetzlaff.com
**LinkedIn:** linkedin.com/in/eric-tetzlaff

---

## THE ORIGIN STORY (in his own words, compressed)

For years he jokingly told people he ran an adult daycare. People in HOA/condo governance settings tend to act like petulant children when they don't get their way. What he eventually understood was that the behavior wasn't the problem — the information architecture was. Where governance gaps exist, personal interpretation, biases, and preconceived notions fill the void that structure should have occupied. An airtight corpus, near-instant impersonal retrieval, and easily referenced historical precedent leaves very little room for any of that.

He spent over a decade manually performing a document intelligence and hierarchy resolution task. He just didn't have that vocabulary for it yet.

---

## CORE CONVICTIONS
*These are non-negotiable. They inform every build, every post, every design decision.*

**1. The system must be architected to say "I don't know" before it is architected to say anything else.**
A hallucinated answer in a high-stakes environment doesn't just fail the user. It can bind an organization to a course of action that contradicts its own legal charter. Honest uncertainty is not a limitation. It is the architecture.

**2. Structural impossibility beats prompt instruction every time.**
If the behavior genuinely cannot happen, you don't need a prompt telling the model not to do it. Build the impossibility into the system. The prompt is the last line of defense, not the first. If your system's safety depends on the model correctly applying a "never" instruction at inference time, you don't have a guardrail. You have a suggestion.

**3. Agentic architecture should almost never be a top-down design process.**
Too many engineers start with the coordinator and work down. If you start at the top, your most capable agents are already on the clock while the scaffolding is still being figured out — filling gaps and roles that were neglected from the start. Build from the ground up. Staff the coordinator last.

**4. Build the version that breaks first. On purpose.**
You cannot get diagnostic information from a system that works. Only a system that fails will show you its own architecture clearly enough to redesign it. Push until it breaks. Sit with the failure long enough to understand exactly what it's telling you. Then build the version that doesn't break.

**5. Pass 100% signal and 0% noise upstream.**
If the noise never makes it to the coordinator, he cannot be bogged down by it — or led astray by it. The coordinator is a senior employee. Don't hand him a filing cabinet and ask him to find the document. Hire someone to find the document first.

**6. Human-in-the-loop is a design decision, not a safety net.**
The question is not whether to include human judgment. The question is where human judgment is load-bearing — and whether you've identified those points deliberately or left them to chance. Consequential, irreversible actions require human accountability not as a fallback for when AI fails, but as the deliberate architecture of who owns that decision.

**7. Context window economics are foundational, not optional.**
Expensive processing belongs in worker subagents, not the coordinator's context. Keyword-first filtering before full extraction. Targeted hydration of confirmed zones only. The coordinator should receive bespoke, pre-processed signal — not raw corpus.

**8. Domain expertise is not incidental to AI system design. It is the design.**
The binders were the training data. The board meetings were the evals. Every time someone asked what to do when the documents didn't have an answer, he was being taught — slowly, manually, at human speed — exactly what he now teaches the systems he builds. The tools changed. The problem didn't.

---

## DESIGN PHILOSOPHY (in his own words)

*"If you wait until you have an answer to figure out how to explain it, you've already made decisions that make full explanation impossible."*
— On the architecture of trustworthy AI systems

*"You cannot get that information from a system that works. Only a system that fails will show you its own architecture clearly enough to redesign it."*
— On deliberate stress-testing

*"Build the version that breaks first. On purpose. Learn everything it has to teach you. Then build the one that doesn't."*
— On iterative build philosophy

*"The corpus does not address this."*
— The most important thing an AI system can say. Permission to say it must be designed in from the start.

*"I get to see what the model is really capable of."*
— What happens when the scaffold is genuinely thorough and the coordinator receives only signal.

---

## GUARDRAIL HIERARCHY
*Applied in this order. Each layer assumes the one above it may not hold.*

1. **Tool permissions** — If a subagent has no access to a tool, it cannot use it. No prompt required.
2. **PreToolUse / PostToolUse SDK hooks** — Intercept every tool call at the infrastructure level before the model sees the output.
3. **Mandated workflows** — Certain actions require prior steps to have completed. Enforced structurally, not by instruction.
4. **System prompt instructions** — Last. Covers genuine judgment calls in ambiguous situations. Never load-bearing safety requirements.

---

## BUILDER PROFILE

- Starts every build with the simplest possible version of the problem
- Pushes it until it breaks — deliberately, controlled, with intent
- Analyzes the failure before building the next version
- Builds from the ground up; staffs the coordinator last
- Stress-tests until he can't break it (and he is very good at breaking things)
- Only then hands the coordinator a desk worth sitting at

**Technical approach:** Python (AI-assisted, not solo from blank file), JavaScript/Node.js (directed implementation), PowerShell, SQL. Anthropic Claude (Opus/Sonnet/Haiku), OpenAI GPT-4o/GPT-4o-mini, MistralAI, Google Gemini/Vision, xAI Grok. Frameworks and infrastructure: Next.js, Supabase (pgvector, RLS, webhooks), Vercel, Stripe, n8n, Loops.so, Resend, Taplio, Apollo.io. Advanced prompt engineering including PreToolUse/PostToolUse SDK hooks, constitutional loops, hardcoded tool exclusions, guardrail architecture, multi-tenant RLS design.

**No formal AI/ML credentials yet** — CCA-F in progress, full education roadmap active.

---

## VOICE AND TONE GUIDE
*For all written output — posts, bios, cover letters, portfolio copy.*

**He writes in complete thoughts, not fragments.** Builds to a conclusion. Doesn't over-explain.

**He is technically credible without being pedantic.** A CTO finds it rigorous. A non-technical founder finds it immediately legible. Never flashy, never braggy, never overstated.

**He is direct.** States convictions plainly. Does not hedge with "perhaps" or "might."

**He uses humor as a disarming tool, not a crutch.** "I used to say I ran an adult daycare." "I'm really good at breaking things." These land because the serious content around them earns them.

**He does not use AI-generated phrasing.** No "delve," no "it's worth noting," no "in the realm of," no "certainly," no "straightforward." No bullet-pointed thought leadership. No generic inspiration.

**Signature phrases and images (use deliberately, not repeatedly):**
- "Watching tokens go up in smoke"
- "The corpus does not address this"
- "Build the version that breaks first"
- "Hand the coordinator a desk worth sitting at"
- "The binders were the training data. The board meetings were the evals."
- "The tools changed. The problem didn't."

---

## PLATFORMS

### BoardPath
Governance intelligence platform for HOA and condominium boards. Converts fragmented governing documents into citation-grounded, meeting-ready answers. Built on Next.js, Supabase, and Vercel.

**Core architecture:**
- Three-stage OCR pipeline: LlamaParse → MistralAI → Google Vision
- Hierarchical document weighting assigns legal authority rank across document types (CC&Rs, Bylaws, Rules & Regs, Amendments, Board Resolutions)
- Proprietary **Transparent Confidence™** scoring evaluates answer reliability across five dimensions: authority rank, citation directness, ambiguity detection, conflict identification, and state statute compliance risk
- **The Boardroom** — AI-powered governance workspace for board meetings and standalone Q&A sessions; context bar, corpus readiness header, 12 topic chips, answer card with Why This Answer? panel
- **Topic Briefs** — 12 pre-generated governance briefs per corpus (Pets, Parking, Architecture, Assessments, Short-Term Rentals, Leasing, Noise, Common Areas, Elections, Fines, Maintenance, Rule Amendments); downloadable DOCX output
- **Document Intelligence Pre-Flight Agent** — Claude Haiku auto-classifies and pre-fills document upload metadata
- Homeowner roster CSV upload with owner picker for correspondence generation
- Amendment chain linking with orphan detection and Warning Center
- Document Readiness Scoring with color-coded health indicator
- DOCX letterhead generation for board correspondence

**Product tiers:**
- BoardPath Community — $29/month (self-managed boards)
- BoardPath Pro — $79/month (CAMs, multi-association)
- BoardPath Chronicle — $1,490/year (see below)

**Timeline:** Demo July 21–25, 2026. Public launch September–October 2026.

---

### BoardPath Chronicle
*BoardPath's primary long-term value proposition and competitive moat. Community and Pro are the on-ramp. Chronicle is the reason people never leave.*

**What it is:** An organizational governance Second Brain — the institutional memory system for HOA communities. Preserves and makes accessible everything a community has ever decided, amended, adopted, or recorded, across any number of board terms and manager changes.

**The governing test for every Chronicle feature:** Does this trace back to governance authority — what the community can require, prohibit, or enforce? Both halves must pass: governance memory, and not general operations software.

**Core framing:** "Your last manager walked out the door with 10 years of institutional memory. BoardPath Chronicle didn't let them take it."

**Feature set:**
- **Historical Q&A with Timeline Awareness** — ask any governance question "as of" a specific date; retrieves from corpus as it existed at that point, including superseded documents. Requires `deactivated_at` timestamp on documents table.
- **Amendment Chain Visualization** — full document lineage from original provision to current state; tree/timeline view, orphan detection and linking CTA
- **Board Decision Audit Log** — searchable log of every formal board decision, vote, motion, and exception grant. Extracted from Boardroom sessions and meeting minutes. `board_decisions` table with VECTOR(1536) embeddings for semantic search.
- **Institutional Memory Reports (Board Orientation Packages)** — AI-generated structured briefing for incoming board members: community overview, governing document summary, amendment history, recent decisions, standing policies, open items. DOCX output via existing generation infrastructure.
- **Governance Health Check** — scores corpus completeness and quality across 5 dimensions (Document Coverage, Amendment Completeness, Currency, Decision Record, Ingestion Quality). Same scoring engine powers external lead magnet and internal dashboard. Labels: Strong 85+ · Moderate 65–84 · Needs Attention 40–64 · Critical <40.
- **Compliance Calendar** — recurring governance obligations extracted from governing documents; deadline tracking, upcoming alerts via Resend email

**Data architecture:**
- `board_decisions` table — UUID PK, association_id, source_document_id, source_session_id, decision_date, decision_type (motion/vote/exception/policy/other), summary, full_text, topics[], embedding VECTOR(1536)
- `compliance_items` table — description, frequency, next_due_date, source_document_id, source_section_id
- `orientation_reports` table — report_content JSONB, docx_storage_key
- `archive_health_scores` table — 5 dimensional scores, generated `label` column, gap_summary JSONB
- `homeowner_inquiry_log` table — topic_slug, confidence_level, needs_board, has_conflict, channel (portal/email/boardroom), asked_at. **No PII stored.** Aggregate pattern intelligence for Health Check and board digest.
- `plan_tier` column on `associations` — free/community/pro/archive; source of truth for all billing gates

**Scope bright lines (Chronicle never becomes):**
- A property management system (no financials, maintenance, or vendor management)
- A legal service (honest uncertainty, counsel_review_recommended flag always active)
- A homeowner communication platform
- A real-time enforcement system
- A financial platform (hardest line — no exceptions)

**Pricing:**
- Annual: $1,490/year
- Founding Member (first 25): $990/year, permanently locked
- Quarterly: $399/quarter
- Setup packages: Self-Serve $0 / Guided Setup $249 / Done-For-You $699

**Build timeline (concurrent with V1.5 Sprints):**
- Tier 1 Schema (Weeks 1–2): A1–A7 Supabase migrations
- Tier 2 Core Features (Weeks 3–6): Historical Q&A, Amendment Chains, Decision Log, Health Check, Orientation Reports
- Tier 3 Stripe Billing (Weeks 4–6): Checkout, webhooks, customer portal, pricing page
- Tier 4 Marketing + Lead Capture (Weeks 6–8): Resend, Loops.so, n8n, Health Check lead magnet, marketing homepage
- Tier 5 Polish + Demo (Weeks 8–10): plan gating, seeded demo data, full rehearsal
- **Demo: July 21–25, 2026**
- **Public launch: September–October 2026**

---

### BoardPath GTM Infrastructure
*Marketing automation architecture designed and partially built alongside the product.*

- **n8n** as central orchestration hub — routes Stripe webhooks, Supabase DB triggers, form submissions to Loops.so, Taplio, Claude API content generation, Resend
- **Loops.so** for marketing email sequences — trial activation, trial conversion, product behavior agents (first upload, first Q&A, first letter), board turnover detection, upsell-to-Chronicle agent
- **Resend** for transactional email
- **Taplio** for LinkedIn content scheduling (4-week content calendar, 20 posts)
- **Apollo.io** for lead enrichment (health check form submissions → person + company enrichment → Loops contact)
- **Governance Health Check lead magnet** — external form, scored against 5-dimension rubric, personalized report emailed within 60 seconds
- Agentic email sequence triggers: board turnover detection (new `association_memberships` → auto-generate orientation report), upsell agent (Pro customer 60+ days active + 3+ documents → Archive pitch), referral agent (usage milestone → $50 credit offer)

---

### Auris Intelligence
Forensic legal document intelligence platform. In active production use by a midsize regional corporate law firm for civil litigation defense preparation. 110,000+ document corpus. SHA-256 chain-of-custody ingestion. Context-window-aware subagent scaffold: keyword-first filtering → targeted zone hydration → worker subagent extraction → coordinator synthesis. 90% false positive elimination on first filtering pass. 98% by full hydration. Output: attorney-ready case analysis, deposition outlines, subpoena targets, chain-of-custody attestations. Node.js DOCX generation layer with branded output. iMazing iOS backup parsing for SMS corpus ingestion.

### Job Search OS
Multi-platform job scanner with tiered AI cost architecture, keyword tracking, and freelance listing generator. Deployed at job-search-os-theta.vercel.app.

### P2P Automation Stack
41% overhead reduction via invoice ingestion pipeline, license plate vision for parking violation processing, document Q&A, and voice-matched correspondence assistant trained on 40,000+ documents.

---

## POSITIONING TARGETS

**Role titles:** Head of AI · AI Systems Architect · Senior AI Engineer · Founding AI Engineer · Applied AI Engineer · AI Solutions Architect

**Company profile:** Series A–C · Remote-first · AI-native or AI-forward · 10–200 employees · Meaningful equity

**Dream employer:** Anthropic (write that cover letter last)

---

## LINKEDIN POST INVENTORY

| # | Title | Type | Status |
|---|-------|------|--------|
| 1 | Auris token burn — watching tokens go up in smoke | Personal narrative | **LIVE** |
| 2 | Building backwards / bottom-up architecture | Narrative + principles | **Queued — next** |
| 3 | Guardrail hierarchy — structural impossibility beats prompt instruction | Framework | Queued |
| 4 | BoardPath soft launch — the board meeting problem | Personal narrative | Queued — post near demo |
| 5 | HITL as design decision, not safety net | Framework | Queued |
| 6 | Design for failure first | Narrative + principles | Queued |
| 7–16 | 4D from the Trenches series (2 per dimension + synthesis) | Mixed | In development |

**Posting cadence:** Tuesday or Wednesday, 10AM–12PM EST. Never Friday or weekend.

---

## BLOG POST INVENTORY

| Title | Status |
|-------|--------|
| I Spent 14 Years Solving a Document Intelligence Problem | Complete — ready to port to site |
| The Roof That Wasn't a Repair | Complete — live on site |
| Confidence Scoring (post-confidence-scoring) | Live on site |
| Context Window Economics (post-context-economy) | Live on site |
| OCR Pipeline (post-ocr-pipeline) | Live on site |
| Human-in-the-Loop as Design Decision (Option C) | Queued |
| Guardrail Hierarchy (Option A) | Queued |
| Design for Failure First (Option D) | Queued |
| 4D from the Trenches — Delegation | Complete and approved |
| 4D from the Trenches — Description | Complete and approved |
| 4D from the Trenches — Discernment | Queued |
| 4D from the Trenches — Diligence | Queued |
| 4D from the Trenches — Synthesis | Writes last, after all 4 dimensions approved |

---

## PENDING DELIVERABLES

- [ ] Email signature — needs headshot at erictetzlaff.com/eric-signature-headshot.png
- [ ] LinkedIn connection sprint to 500+
- [ ] About page — portfolio site (long-form bio — approved, not yet ported)
- [ ] Blog post Option C — HITL as design decision
- [ ] Blog post Option A — Guardrail hierarchy
- [ ] Blog post Option D — Design for failure first
- [ ] Job Search OS portfolio page
- [ ] GitHub — 3 public repos live (blocking certain resume claims)
- [ ] First job-specific resume + cover letter
- [ ] Anthropic cover letter (write last)
- [ ] BoardPath Chronicle — Supabase schema Tier 1 (tasks A1–A7)
- [ ] BoardPath demo July 21–25 → update resume URL + LinkedIn featured
- [ ] LLC formation / ToS / Privacy Policy / E&O insurance workstream (4–8 week lead times — must run now)
- [ ] USPTO trademark check: "The Boardroom" Class 9/42 before demo day
- [ ] BoardPath pricing page at /pricing
- [ ] Community/Pro annual pricing rates finalized before first paying customer

---

*This document is a living record. Update it every time a new post is drafted, a new conviction is articulated, a new deliverable is completed, or the positioning shifts. It is the authoritative source of truth for this project.*

# Forming Paws — Foundation Design (Phase 0 + Phase 1)

## Context

Stefan wants to build **Forming Paws**, a health-first, safety-first nonprofit platform that facilitates documented, responsible dog breeding — starting in Chicago, IL, on $0 capital. He's driving this via a master build prompt that specifies its own Phase 0 (discovery interview) → Phase 1 (agent team) → Phase 2 (product build) → Phase 3 (business plan) → Phase 4 (funding) → Phase 5 (execution roadmap) structure, plus a Triple-Audit Protocol (accuracy / error / alignment passes) applied to every deliverable.

This document captures Phase 0 and Phase 1 — the foundation everything else builds on. Phases 2-5 get their own implementation plan once this is approved (see "Next Step" below).

The agent infrastructure this project runs on (MUNDI Router, `~/clawd/router/`, 233-persona subagent pool at `~/.claude/agents/`) was built in an earlier session this week — this spec reconciles Stefan's master prompt against what's *actually* built and working, rather than assuming a fresh setup.

## Phase 0 — Alignment Brief

**Mission:** A health-first, safety-first nonprofit platform facilitating documented, responsible dog breeding — starting in Chicago, IL, on $0 capital.

**Scope:** Dogs only at launch; data model built extensible so other species can be added later without a rework. Illinois-based matches only — ToS notes owners are responsible for their own state's rules if a match happens to cross a nearby border (Chicago metro naturally spills toward IN/WI); no geofencing at MVP.

**Structure:** 501(c)(3) nonprofit as the whole entity (no separate for-profit arm), open to fiscal sponsorship to accept donations before IRS approval lands. Revenue is any nonprofit-compatible combination — donations, listing boosts, vet-referral partnerships, sponsored education content, membership tiers — phased priority proposed during Phase 2/3 planning, not fixed now.

**Trust & safety:**
- Matching/chat unlocks only after baseline health docs are uploaded: a vet wellness exam (≤12 months old) + core vaccinations (rabies, DHPP)
- Verification is **automated plausibility-checking** at launch — document exists, is recent, looks complete — explicitly NOT automated medical judgment (that would be a real liability risk an LLM can't back up). Anything questionable routes to manual review.
- Optional "Gold" badge tier for OFA hip/elbow certification + Embark/DNA panel — not gated, doubles as a future premium-feature hook
- Meetup safety: in-app chat locked until mutual match, suggested neutral/public meeting locations. ID verification deferred until the platform scales — no vendor cost at launch.

**Anti-mill safeguards (non-negotiable):**
- 1 litter per dog per 12-month rolling period
- Breeding age gate by size category (rough ranges, not full veterinary precision)
- Baseline health docs required (above)
- Responsible-breeding education acknowledgment required before profile activation
- Community reporting + admin review queue
- Rescue/adoption options cross-promoted alongside search results (not gated)

**Operating constraint:** Stefan has **~30 min/day**. This is the single biggest driver of the build approach — the agent system carries nearly all execution; his time goes to approvals and irreversible/paid decisions, not hands-on building.

## Phase 1 — Agent Team Architecture

The master prompt's 8 conceptual subagent roles, mapped onto **real, verified personas** already seeded in `~/clawd/router/subagents.json` (233-persona pool at `~/.claude/agents/`) — not invented from scratch:

| Role | Real persona (`persona_id`) | Routes through | Why |
|---|---|---|---|
| architect | `engineering-software-architect` | Claude | High-stakes design calls need the strongest reasoning |
| frontend-builder | `engineering-frontend-developer` | Gemini once keyed → Claude for UX-critical screens | Cheap scaffolding vs. escalate only when it matters |
| backend-builder | `engineering-backend-architect` | Claude | API/auth/storage/chat — security-sensitive |
| db-engineer | `engineering-database-optimizer` | Claude | Schema + row-level security — get this wrong once and it's bad |
| qa-auditor | `testing-reality-checker` + `engineering-code-reviewer` | Claude | Two lenses: reality-checker's "prove it, don't tell me" ethos fits the Triple-Audit Protocol's alignment pass; code-reviewer covers technical correctness |
| biz-strategist | `business-strategist` | Claude (Perplexity for market-research legwork once keyed) | |
| grant-scout | `grant-writer` persona **+ the real Granted MCP tool** (live grant database, already connected in this environment) | Perplexity once keyed → Claude using Granted MCP directly meanwhile | Master prompt requires "no invented grants" — the persona alone can't guarantee that without a real data source |
| content-writer | `marketing-content-creator` | ChatGPT once built | High-volume, low-risk — the role that most benefits from a cheap dedicated model |

**Primary agents — 5 total, honest current state:**
- **Claude** — fully working today, no setup needed (`claude -p` via the router's `cli_subprocess` mode)
- **Antigravity** — fully working today, mechanically identical to Claude currently (no distinct persona-framing built yet)
- **Gemini** — script exists (`~/clawd/agents/gemini-agent/run.js`), key is provisioned, but currently hitting a 429 rate-limit/quota error on real calls — needs a plan/billing check, not new code
- **Perplexity** — script exists (`~/clawd/agents/perplexity-agent/run.js`), a task was attempted but failed on a bus-posting error (`busctl.js` SQLite insert failure) — this is a real bug to fix, separate from provisioning
- **ChatGPT** — does not exist yet. Building it (new script, same pattern as gemini-agent/perplexity-agent) plus getting an OpenAI API key is the first concrete task once implementation starts.

Until Gemini's quota issue and Perplexity's bus-posting bug are fixed, and ChatGPT is built, **all subagent work above practically routes through Claude** — the "routes through" column above is the target state, not a claim that it's live today.

**MUNDI is the orchestrator Stefan talks to directly.** Invocation from a terminal: `cd ~/clawd/router && node run.js "<task text>"`.

## Next Step

Phases 2 (product build), 3 (business plan/nonprofit structure), 4 (funding strategy), and 5 (execution roadmap) need their own implementation plan, scoped to Stefan's 30 min/day constraint. Before that plan is written, three things from Phase 1 need fixing first since they block real agent work: the Gemini quota/billing issue, the Perplexity bus-posting bug, and building the ChatGPT integration.

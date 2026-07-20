# Forming Paws — Execution Plan

**Decisions (locked 2026-07-19):**
- **Structure:** Nonprofit path — 501(c)(3) as the destination, fiscal sponsorship as the bridge. Starting from zero (no entity, no EIN).
- **First revenue:** Verified-badge fee — browsing free; owners pay for health-document review that unlocks matching.
- **Launch market:** Founder's home metro (CITY TBD — set this before Day 8).
- **Founder time budget:** Under 5 hours/week. Every task below is sized to that.

## Operating rule

Claude builds, drafts, and automates; the founder does the things that legally or socially require a human: signatures, filings, phone calls, and showing up locally. Founder tasks are marked **[YOU]** and average 30–40 min/day.

---

## Phase 1 — Foundation (Days 1–30)

### Week 1 — Capture demand before the product exists
- Day 1: Waitlist live on the site (email + city + breed). *(Claude — done)*
- Day 2 **[YOU]**: Name your launch city. Post the site link in one local Facebook group you already belong to.
- Day 3 **[YOU]**: List 5 vet clinics + 3 dog parks + 2 breed clubs in your metro (just names/links, 20 min).
- Day 4: Claude drafts outreach messages to each (vet partnership pitch: they get referrals from unverified dogs; you get a credibility partner).
- Day 5 **[YOU]**: Send the 5 vet outreach emails from your own address.
- Day 6–7: Claude builds real accounts + dog profiles on Supabase (replaces demo data).

### Week 2 — Legal from zero
- Day 8 **[YOU]**: Choose the official nonprofit name (Forming Paws or variant); check name availability on your state's Secretary of State site (15 min).
- Day 9: Claude drafts articles of incorporation with required 501(c)(3) language + bylaws from your state's template.
- Day 10 **[YOU]**: Recruit 2 board members besides yourself (IRS effectively expects ≥3 directors; family is allowed but a majority should be unrelated). Ask people who care about dogs.
- Day 11 **[YOU]**: File incorporation online (state fee typically $50–$300 — first real cost; a GoFundMe among friends can cover it).
- Day 12 **[YOU]**: Get EIN free at irs.gov (10 minutes, instant).
- Day 13–14: Claude researches fiscal sponsors accepting animal-welfare projects so donations can start before IRS approval; drafts applications.

### Week 3 — Product becomes real
- Claude: photo upload, health-doc vault, verified-badge workflow, admin review queue.
- Day 18 **[YOU]**: Create your own real profile + your dog (or a friend's) as first listing.
- Day 20 **[YOU]**: Invite 5 dog owners you personally know. First 20 users get "Founding Member" status — free verification for life.

### Week 4 — First money
- Claude: Stripe checkout for the verification fee (Stripe works with EIN once incorporated; nonprofit discount comes later).
- Pricing at launch: **$29 one-time per dog** for document review + Verified badge. Founding members free.
- Day 28 **[YOU]**: File IRS Form 1023-EZ if eligible ($275 fee) — Claude pre-fills the worksheet.
- **Go/no-go gate:** 25+ waitlist signups and 5+ real dog profiles by Day 30. If short, Week 5 becomes a marketing-only sprint before more building.

## Phase 2 — Local traction (Months 2–3)
- Weekly content: Claude writes 3 posts/week (dog-health education + local angle); **[YOU]** post them (~20 min/wk).
- 1 vet partnership signed → their logo on the site, referral flow live.
- Verified matching + chat fully live; demo page retired.
- Grant search begins (Claude, via live grant database) once fiscal sponsorship or 501(c)(3) exists.
- **Metric:** 100 users, 25 verified dogs, first 10 paid verifications (~$290), first match made.

## Phase 3 — Revenue engine (Months 4–6)
- Add annual **Pack Membership** ($49/yr: verification + priority matching + education library).
- First grant application submitted (animal-welfare / community-health funders).
- Local press: "local nonprofit fights puppy mills with health-verified matchmaking" — Claude drafts the pitch.
- **Metric:** $500+/month recurring, 1 grant submitted, 250 users.

## Phase 4 — Mission expansion (Months 7–12)
- Vet-referral "Get Healthy" pathway generates partner revenue.
- Second metro launch (pick by waitlist density).
- Facility feasibility study — the long-term safe breeding/whelping space.
- **Metric:** covering costs from revenue; 501(c)(3) determination received.

---

## Costs (starting from $0)
| Item | Cost | When |
|---|---|---|
| Hosting (GitHub Pages + Supabase free tier) | $0 | now |
| Domain (formingpaws.org) | ~$12/yr | Week 1 (optional but recommended) |
| State incorporation | $50–$300 | Week 2 |
| IRS 1023-EZ | $275 | Week 4 |
| Stripe | % of transactions only | Week 4 |

## Standing risks
- **Density:** matching fails without local concentration — resist marketing outside the launch metro until 100 local users.
- **Trust:** one puppy-mill incident kills the brand — verification stays mandatory, litter caps enforced from day one.
- **Founder time:** at <5 h/wk, consistency beats intensity; the 30-minute daily task is the whole job.

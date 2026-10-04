# Five new education guides: design and sources

**Date:** 2026-09-23
**Goal:** Add Illinois law, written agreements, training, behaviour help and year-round wellness to `/education`, written for owners, with every factual claim traceable to a primary source.

## What was decided, and why

**Guides, not services.** Stefan confirmed these teach owners; none of them claims Forming Paws provides training, behaviour consulting or a wellness programme. `behaviour-help` says so outright, because a page listing professionals reads as a referral service unless it denies being one.

**Sources are rendered, not filed.** `Guide` gained an optional `sources: { label, url }[]`, shown at the foot of the page. A guide that tells an owner what a statute requires has to show the statute. A unit test requires at least two sources on any guide carrying the legal notice.

**The notice is per guide.** `Guide.notice` is `'vet' | 'legal'`. "Not veterinary advice" is the wrong sentence on a page about the Animal Welfare Act, and one merged notice would blunt both. The hub card labels itself "Vet-reviewed · Not yet" or "Lawyer-reviewed · Not yet" to match.

**Reading times are computed, not guessed.** Set at `ceil(words / 200)` and pinned by a test. Writing these exposed the existing three guides claiming 3 to 4 minutes for 211 to 281 words, roughly triple their real length; those were corrected in the same change.

## Sources, and what could not be verified

Every URL cited in a guide was loaded and read during the work, except as noted. Statute links point at the Illinois General Assembly's own text, section by section.

| Claim | Source |
|---|---|
| "Dog breeder" definition, five-female licensing line, pet shop exclusion, "offer for sale" | 225 ILCS 605/2 |
| Eight-week separation, licensee records, pedigree proof | 225 ILCS 605/2.2 |
| Who must hold a licence | 225 ILCS 605/3 |
| The seven-item disclosure list | 225 ILCS 605/3.1 |
| Pet shop sourcing limits and buyer remedies | 225 ILCS 605/3.8, /3.15 |
| Rabies: four months, second dose within a year, county certificate, microchip number | 510 ILCS 5/8 |
| Chicago licence at four months, rabies proof, fees | Chicago Municipal Code 7-12-140 and 7-12-170; City Clerk dog registration page |
| Reward-based training only; the aversive tools named; the risks | AVSAB Humane Dog Training position statement (2021) and AVSAB's own explainer |
| Socialisation window, socialising before the vaccine series completes | AVSAB Puppy Socialization position statement |
| CPDT-KA hours, attestation, exam, LIMA policy, recertification | CCPDT certification pages |
| IAABC experience requirements | IAABC credentials page |
| CAAB and ACAAB degrees and experience | Animal Behavior Society certification page |
| Parasite schedules, heartworm testing, zoonotic hygiene | Companion Animal Parasite Council general guidelines |

**Not cited, because it could not be read:** AAHA's canine life stage and vaccination guidelines block automated access. The wellness guide therefore attributes its examination cadence to veterinary guidance generally, and takes its specifics from CAPC and from Illinois law instead.

**Deliberately absent:** the qualifying age for Chicago's senior licence rate (the Clerk lists the rate, not the age); exact veterinary behaviorist caseload and publication counts (the college's policy document could not be loaded, so the guide describes the residency in general terms); vaccine intervals beyond rabies, which belong to a veterinarian and not to us.

## Follow-ups

- Five new guides have no header illustration. `guideArt` misses gracefully by design, so they ship without one.
- The footer's "Vet-reviewed guides · Not yet" remains accurate and was left alone.
- Fee figures in the Illinois guide are marked "at the time of writing" and link to the Clerk; they should be checked when the ordinance changes.

# Crowd Flow Optimiser — Expert Review & Addendum

**Reviewing:** `CROWD_FLOW_OPTIMISER_BUILD_PLAN.md` against Problem Statement 3
**Verdict up front:** the plan is unusually good — it already cites Fruin, Weidmann, and the IMO correctly, and the flow-field + twin-simulation architecture is the right call for a 36-hour build. Do not restructure it. What follows is what I'd patch before you start coding: one narrative swap that will land much harder with this specific audience, two technical corrections a domain expert will probe on, one cheap simulation upgrade, and a concrete frontend direction so the UI doesn't read as generic hackathon output.

---

## 1. Swap your headline disaster — you're sitting on a better one

The plan opens the demo script with Itaewon (2022). That's a fine citation, but you're building the **Kumbh Mela ghat scenario as scenario #2** already, and there's a far more resonant, far more recent incident that maps onto it exactly:

> **29 January 2025, Maha Kumbh Mela, Prayagraj.** A crowd crush at the Sangam ghat (confluence of the Ganges, Yamuna and Saraswati) killed at least 30 people and injured 60+ on Mauni Amavasya, the festival's biggest bathing day. Pilgrims sleeping on the riverbank were trampled after others jumped barricades to reach the water. Up to 100 million people were expected on-site that day. It was the **sixth** crowd crush at Kumbh Mela in 70 years. [Al Jazeera](https://www.aljazeera.com/news/2025/1/29/several-reported-killed-in-crush-at-religious-festival-in-india) · [Wikipedia](https://en.wikipedia.org/wiki/2025_Prayag_Maha_Kumbh_Mela_crowd_crush) · [BBC](https://feeds.bbci.co.uk/news/articles/c3rwjnr12lwo)

Why this beats Itaewon for your room:
- It's **this year, in India**, at an event most judges will know by name — it doesn't need explaining the way a Seoul alleyway does.
- It happened **despite** active AI crowd-monitoring (300 cameras, drones) deployed for exactly this purpose. That is your pitch, verbatim: *monitoring told them where the crowd already was; nothing told them 90 seconds ahead that barricade-jumping was about to turn a bathing queue into a crush.* You don't have to invent the gap between "detection" and "prediction" — this incident **is** that gap.
- Your scenario 2 (`ghat.json`) stops being a generic "second layout to prove reusability" and becomes *the actual incident you're modelling.* Build the barricade-jump behaviour in as a parameter (a fraction of agents that route around a `goal` instead of through it once density crosses a threshold) — even a crude version of this is a striking, on-theme moment in the demo.
- Keep Itaewon as a **secondary** citation in Section 12 Q&A (it's still the best-documented dense-crowd physics case in the literature), but open with Kumbh Mela.

Rewrite the hook (Section 11, 0:00–0:30) as:

> "On January 29th this year, a crowd crush at the Maha Kumbh Mela in Prayagraj killed at least 30 people. There were 300 cameras and drones watching that ghat. They could see exactly how crowded it was. What none of them could do was tell anyone 90 seconds *before* it happened. That's the gap we built for."

---

## 2. Two technical claims in the plan that a judge with domain knowledge will test

### 2.1 RT-DETR will undercount your calibration photo, and you should say so before they ask

Section 7.6 uses `PekingU/rtdetr_r50vd_coco_o365`, a **box detector**, to count people in a photo and calibrate arrival rate. Box detectors are trained on scenes where individual people are mostly unoccluded. Past roughly 40–80 visible people in a frame — exactly the kind of photo you'd want to show for a Kumbh Mela-style scenario — heavy overlap causes NMS to merge or drop boxes, and counts saturate well below the true number. This is a well-documented failure mode; it's *why crowd counting split off from object detection as its own subfield.* [CSRNet](https://arxiv.org/pdf/1802.10062) and [DM-Count](https://huggingface.co/litert-community/DM-Count-Crowd-LiteRT) exist specifically because detectors break down in dense scenes — they regress a density map (sum of the map = count) instead of drawing boxes, so overlapping heads don't cost you a detection.

You have three honest options, in order of effort:
1. **Cheapest — do nothing, just pre-empt the question.** Use a photo of a moderately busy gate (30–50 people) for the live demo, where RT-DETR is accurate, and have this exact sentence ready: *"Detection-based counting saturates in genuinely dense crowds — past about 50 overlapping people you want a density-regression model like CSRNet, not a box detector. We used RT-DETR because our calibration photos are gate queues, not pack-density crowds; that's a deliberate scope choice, not an oversight."* This turns a potential gotcha into a sign you understand the field.
2. **Medium — swap the model.** `litert-community/DM-Count-Crowd-LiteRT` or a CSRNet checkpoint on the Hub gives you a density-map count that holds up in dense scenes, still a one-line pipeline swap in `detect.py`.
3. **Best if you have a spare hour in the 22–27 window — offer both and show the contrast.** Run RT-DETR and a density model on the *same* dense photo, show RT-DETR undercounting, show the density model tracking closer to ground truth. That's a 20-second demo beat that is genuinely more sophisticated than almost anything else at the event, because it shows you understand *why* your model choice is correct rather than just having called an API.

Either way, **do not let this surface for the first time when a judge asks it live.** Bake the caveat into your own script (Section 12 already has a slot for exactly this kind of answer — add it there).

### 2.2 Your risk bands have a second citable authority, and it also updates your WATCH threshold's story

The plan cites Fruin and the IMO. Add the UK's **Purple Guide** (the event-safety industry standard, HSE-endorsed): it caps standing crowd density at **2.5 p/m² for short-duration free movement**, and uses **2.0 p/m²** as the working figure for safe-capacity calculations. [Purple Guide summary](https://imperialsecurity.agency/security-articles/event-security-articles/the-purple-guide-understanding-uk-event-safety-standards/) · [flow-rate maths](https://incrowdsafety.co.uk/flow-rates-densities-and-the-maths/)

This is good news, not a correction: your `WATCH` band already starts at exactly 2.0 p/m². You can now say "our WATCH threshold is where the Purple Guide's own safe-capacity figure ends" — a second independent standard landing on your number is a stronger claim than one standard alone.

Also cite the **DIM-ICE** framework by G. Keith Still (Design, Information, Management × Ingress, Circulation, Egress) — it's the standard risk-management model event safety professionals actually use, and your three zone types (`gate`, `concourse`, `exit`) map onto Ingress/Circulation/Egress almost exactly. One sentence in your deck — *"we structured our zones around the DIM-ICE model"* — signals you read a professional's framework, not just his density table. [Still's work](https://www.gkstill.com/Support/crowd-density/CrowdDensity-1.html)

---

## 3. A cheap simulation upgrade: local repulsion via spatial hashing (do this if Hours 16–22 have slack)

The plan's `agents.py` repulsion (density-gradient descent, `REPULSION = 0.35`) is the right call for the *default* build — it's O(N), and the plan is correct that pairwise social-force is O(N²) and won't survive 5,000 agents in Python. But gradient repulsion alone won't produce genuine **agent-agent** avoidance, which means it can't produce **lane formation** — the phenomenon where two opposing flows spontaneously separate into stable lanes without being told to. This is one of the most well-studied, most visually convincing emergent behaviours in the pedestrian-dynamics literature. [PLOS Comp Bio](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002442) · [lane formation review](https://www.sciencedirect.com/science/article/abs/pii/S0378437115002666)

You already compute a density grid every tick. Getting local repulsion is nearly free:

```python
# after density_grid(): bin agents into the same coarse cells you already have
cell_of_agent = (row, col) computed once, reused for both density and repulsion
for each occupied cell:
    for each agent in that cell and its 8 neighbours:
        push apart along the line between them, weighted by 1/distance
```

That's still O(N) on average (bounded neighbours per cell, not all N agents), and it's maybe 15 extra lines on top of code you're already writing. If you get it in, **add a second scenario with two spawns walking toward each other's goals** (an easy JSON edit — swap two `goal` fields) — watching lanes spontaneously form live is a stronger "the physics is real" beat than anything in the current Section 11 script. If you don't have time, skip it; the current repulsion is defensible and the plan already says so.

**Do not** reach for RVO2/ORCA (Section 2's velocity-obstacle family) — it's the theoretically cleaner solution but it's a per-agent optimisation with a real integration cost, and you have 36 hours. Spatial-hash repulsion gets you 80% of the visual effect for a fraction of the work.

---

## 4. deck.gl / WebGL rendering — verdict: skip it, and say why if asked

I checked whether Canvas 2D (Section 8.3) would fall over at your scale. It won't: Canvas 2D comfortably handles tens of thousands of points; deck.gl/WebGL only starts paying for itself in the hundreds-of-thousands range, and it costs you a GPU-buffer learning curve you don't have hours for. **Keep Canvas 2D exactly as specified**, single `beginPath()`/`fill()` as the plan already insists on. If a judge asks about scaling past 5,000 agents, the honest answer is "Canvas 2D is fine to ~50k points; past that you'd move to deck.gl, which is a rendering swap, not an architecture change" — you don't need to have built it to give that answer credibly.

---

## 5. Competitive landscape — have this answer ready, it's a strong one

Real products already do parts of this: **CrowdVision** (UK) does live crowd analytics and is the system Saudi authorities use to protect pilgrims at Hajj; Bosch, Huawei, Axis and others sell camera-based crowd-density video analytics. A judge who's done five minutes of homework may ask "isn't this already solved?" [CrowdVision / Hajj](https://www.cbinsights.com/company/crowdvision)

Your honest, differentiated answer — and it's the same point Section 12 already makes about cameras, so this just sharpens it:

> "CrowdVision and similar systems tell you what the crowd is doing *right now*, from cameras. That's real and it's valuable — it's also exactly what was deployed at Kumbh Mela in January and it didn't stop the crush, because knowing the current density doesn't tell you where it's *heading*. We're not competing with the sensing layer — we're the layer that's missing on top of it: a forward simulation that turns 'this is what's happening' into 'this is what happens in 90 seconds if nobody acts, and here's the specific action that changes it.'"

That's a materially better answer than pretending no one else works in this space.

---

## 6. Frontend: making it not read as generic hackathon output

You asked specifically for this, so it gets its own section. The plan's frontend (Section 8) is functionally correct — Tailwind, `rounded-xl` white cards, light background — but that visual language is what *every* team's LLM-scaffolded dashboard looks like this year: soft shadows, rounded corners on everything, a pastel accent, generic sans-serif everywhere. It'll work, but it won't look like anything.

**Steer toward the thing your own premise already describes: a control room, not a SaaS admin panel.** Concretely:

- **Dark-first, not light-first.** Control rooms are dark because operators stare at them for hours — that's not just an aesthetic choice, it's the actual reason real monitoring UIs (traffic control, NOC dashboards, Bloomberg terminals) are dark. It also happens to look nothing like a generated Tailwind template.
- **One accent colour, used sparingly** — plus your five risk-band colours, which are your real palette and should visually dominate. Don't add a second decorative brand colour on top of them.
- **Monospace for every number** (density readings, countdown timers, KPIs) — `JetBrains Mono` or `IBM Plex Mono`. Keep a plain grotesk for labels. Numbers-in-monospace is the single fastest way to make a dashboard look like an instrument rather than a website; it's also literally more scannable, which matters when you're asking a judge to read a density value from six feet away.
- **Flatten the cards.** Hairline borders instead of shadows, tighter padding, higher information density. Real monitoring tools (PostHog's density, Linear's restraint, Bloomberg-style terminals) read as credible specifically *because* they don't decorate — contrast and hierarchy do the work, not rounded corners and drop shadows.
- **The venue map should look like a technical floor plan**, not an illustration — thin grid, precise wall linework, muted fills. That's also just... what the plan's own Canvas code already draws, once you change the palette.
- **Never rely on colour alone for risk state.** Red/green is the one part of your design a colourblind judge (or a photo of your screen) will lose. The plan already prints the numeric ρ next to every risk badge — keep that discipline everywhere risk colour appears, including the canvas zone labels.

I built a working reference to make this concrete rather than just describing it — see the artifact linked below. It's not your final UI, it's a layout/palette/type reference your Person D can crib CSS variables and structure from in an afternoon, using the exact tick-JSON shape already frozen in Section 6.2.

*(On tools: no design software was required for this — it's hand-built HTML/CSS/SVG matching your existing data contracts. If you want an actual Figma file, real venue-photo backgrounds, or icon assets beyond what I can draw in SVG, tell me and I'll ask you for the specific tool/access rather than guess.)*

---

## 7. Small additions worth folding in, in priority order

1. **Kumbh Mela 2025 as the primary hook** (Section 1 above) — highest leverage, ~10 minutes of script editing.
2. **RT-DETR caveat baked into your own talking points** (Section 2.1) — cheap insurance against the single most likely "gotcha" question.
3. **DIM-ICE + Purple Guide citations** added to Section 2.4/Section 12 of the original plan — a few sentences, reinforces you did the reading.
4. **CrowdVision/competitive framing** added to Section 12 — pre-written answer, zero build cost.
5. **Spatial-hash local repulsion + a counterflow scenario** (Section 3 above) — only if Hours 16–22 have slack; skip without guilt otherwise.
6. **Frontend palette/type direction** (Section 6 above) — before Person D starts on components, not after.

Nothing here should change your architecture, your file layout, or your hour-by-hour plan. It's the same build, aimed slightly better.

---

## Sources consulted

- [2025 Prayag Maha Kumbh Mela crowd crush — Wikipedia](https://en.wikipedia.org/wiki/2025_Prayag_Maha_Kumbh_Mela_crowd_crush)
- [Al Jazeera — at least 30 killed in crush at Mahakumbh Mela](https://www.aljazeera.com/news/2025/1/29/several-reported-killed-in-crush-at-religious-festival-in-india)
- [BBC — Thirty killed in crowd crush at Kumbh Mela](https://feeds.bbci.co.uk/news/articles/c3rwjnr12lwo)
- [CSRNet paper (arXiv)](https://arxiv.org/pdf/1802.10062)
- [DM-Count crowd model — Hugging Face](https://huggingface.co/litert-community/DM-Count-Crowd-LiteRT)
- [Crowd counting models — Hugging Face Hub listing](https://huggingface.co/models?other=crowd-counting)
- [Traffic Instabilities / lane formation — PLOS Comp Bio](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002442)
- [Lane formation in pedestrian counterflows — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0378437115002666)
- [Spatial hashing for crowd simulation — background](https://www.gorillasun.de/blog/particle-system-optimization-grid-lookup-spatial-hashing/)
- [Social Force Model — Helbing, ResearchGate](https://www.researchgate.net/publication/1947096_Social_Force_Model_for_Pedestrian_Dynamics)
- [RVO/ORCA overview — Fast Simulation of Crowd Collision Avoidance](https://link.springer.com/chapter/10.1007/978-3-030-22514-8_22)
- [deck.gl](https://deck.gl/) and [charting-library performance comparison](https://www.ridhwaan.xyz/blog/choosing-a-charting-library-echarts-d3-recharts-plotly-chartjs-deckgl/)
- [CrowdVision — crowd analytics at Hajj](https://www.cbinsights.com/company/crowdvision)
- [The Purple Guide — UK event safety standard](https://imperialsecurity.agency/security-articles/event-security-articles/the-purple-guide-understanding-uk-event-safety-standards/)
- [Flow rates, densities and the maths — InCrowd Safety](https://incrowdsafety.co.uk/flow-rates-densities-and-the-maths/)
- [G. Keith Still — Standing Crowd Density / DIM-ICE](https://www.gkstill.com/Support/crowd-density/CrowdDensity-1.html)
- [Vadere — open-source pedestrian simulation framework](https://www.vadere.org/)

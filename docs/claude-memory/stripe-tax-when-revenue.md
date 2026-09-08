---
name: stripe-tax-when-revenue
description: "When GlobeSkimmers has real revenue (first live-mode Stripe package sale, or steady Nuitée commissions), remind the founder to set up taxes properly — they asked 2026-09-07."
metadata: 
  node_type: memory
  type: project
  originSessionId: 39b99a63-daec-4b21-b146-3aa727a6f9ac
  modified: 2026-09-07T09:10:03.845Z
---

**Trigger: first real revenue** — a live-mode (not test) Stripe package payment, or Nuitée commissions actually accruing. When that happens, remind Maiza (they/them) about the tax work they deliberately skipped during Stripe activation on 2026-09-07:

1. **Stripe Tax** was skipped at activation (correctly — no honest product category existed for travel packages, and it costs ~0.5%/transaction). Revisit at Settings → Tax in the Stripe Dashboard.
2. Before enabling anything, they should talk to an **accountant about travel-package tax treatment** — agent vs principal, hotel occupancy taxes (Nuitée as MoR handles the hotel-rail side), and which states/countries the package lane creates obligations in.
3. Stripe monitors registration thresholds for free in the meantime — check Settings → Tax for any threshold warnings that accumulated.

Do not nag before revenue exists. Related: [[smart-packages-doctrine]] (Stripe Wave 1 state).

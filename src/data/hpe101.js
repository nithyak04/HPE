// ============================================================================
// HPE 101 — content data
// ----------------------------------------------------------------------------
// Everything a person reads on this page lives in this one file. The render
// layer (src/components/**) just walks this array and picks a component
// based on each section's `type`. To update copy, edit the strings below —
// no JSX or markup knowledge required. Do not rename `id` values; they are
// used as anchors and as localStorage keys for progress tracking.
// ============================================================================

export const hpe101 = {
  id: 'hpe-101',
  navLabel: 'HPE 101',
  title: 'HPE 101',
  tagline: 'The org chart, the products, and the business model — in plain English.',
  icon: '🟢',
  estMinutes: 15,
  sections: [
    // --------------------------------------------------------------------
    // 0. Start here
    // --------------------------------------------------------------------
    {
      id: 'start-here',
      navLabel: 'Start here',
      type: 'intro',
      eyebrow: 'Welcome',
      title: 'Welcome to the Chips/AI finance team',
      content: {
        body: [
          "This is a crash course in what HPE sells, how it's organized, and how the money works — written for someone who is new to enterprise tech, not someone who already knows it.",
          'Read top to bottom the first time. After that, jump to whatever section you need from the sidebar. Your progress is saved on this device, so you can pick up where you left off.',
        ],
        bullets: [
          {
            num: '01',
            title: 'Org structure',
            body: 'How HPE is split into two segments as of FY26.',
          },
          {
            num: '02',
            title: 'Products',
            body: 'What HPE actually sells, in six flip cards.',
          },
          {
            num: '03',
            title: 'The billing model',
            body: 'Try the GreenLake bill simulator yourself.',
          },
          {
            num: '04',
            title: 'Finance & you',
            body: "Where your work fits into all of this.",
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 1. Org structure
    // --------------------------------------------------------------------
    {
      id: 'org-structure',
      navLabel: 'Org structure',
      type: 'toggle',
      eyebrow: 'How HPE is organized',
      title: 'One company, two segments',
      lede: 'Starting FY26, HPE consolidated from five reporting segments down to two. Toggle between them below.',
      content: {
        tabs: [
          {
            id: 'cloud-ai',
            label: 'Cloud & AI',
            summary:
              'Everything to do with compute, storage, and consuming it all as a service. This is the larger of the two segments and where most of the AI infrastructure story lives.',
            tags: ['Servers', 'Storage', 'HPE Financial Services', 'GreenLake', 'AI systems'],
            items: [
              'Servers — the physical and virtual machines that run customer workloads, including AI training/inference systems.',
              'Storage — where customer data lives, with performance and durability guarantees.',
              'HPE Financial Services (FS) — leasing, financing, and asset management so customers don’t have to pay for everything up front.',
              'GreenLake — the consumption-based platform that lets customers rent this infrastructure like a utility instead of buying it outright.',
            ],
          },
          {
            id: 'networking',
            label: 'Networking',
            summary:
              'Built around the 2024 acquisition of Juniper Networks, combined with HPE’s existing Intelligent Edge business (Aruba). This segment moves data between everything the Cloud & AI segment runs.',
            tags: ['Juniper Networks', 'Intelligent Edge / Aruba', 'Switching', 'Wi-Fi', 'SD-WAN'],
            items: [
              'Juniper Networks — high-performance routers and switches, mostly for large enterprise and service-provider networks, acquired by HPE in 2024.',
              'Intelligent Edge (Aruba) — Wi-Fi, campus switching, and network security for offices, campuses, and retail locations.',
              'Together, this segment is the plumbing: it moves data reliably between servers, storage, clouds, and end users.',
            ],
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 2. Product breakdown (flip cards)
    // --------------------------------------------------------------------
    {
      id: 'product-breakdown',
      navLabel: 'Products',
      type: 'flipgrid',
      eyebrow: 'What HPE actually sells',
      title: 'Six things to know, click to flip',
      lede: 'Each card is a product line you’ll see referenced constantly in decks, deals, and forecasts. Click a card to see the plain-English version.',
      content: {
        cards: [
          {
            front: 'Servers',
            back: 'The physical machines that do the actual computing — running applications, crunching data, or training/serving AI models. Think of them as very powerful, very specialized computers that live in a data center instead of on a desk.',
          },
          {
            front: 'Storage',
            back: 'Hardware that holds customer data long-term, built to be fast, reliable, and hard to lose data from. Every server needs somewhere to read and write data, and this is that place at enterprise scale.',
          },
          {
            front: 'GreenLake',
            back: 'HPE’s "as-a-service" platform. Instead of a customer buying servers and storage outright, they consume it like a utility bill: usage goes up, the bill goes up; usage drops, the bill drops. It’s the wrapper around the hardware that makes it feel like a subscription.',
          },
          {
            front: 'Private Cloud',
            back: 'A version of "the cloud" (on-demand, self-service computing) that runs on infrastructure a customer controls — in their own data center or a dedicated facility — rather than on shared public infrastructure like AWS or Azure. Same convenience, more control.',
          },
          {
            front: 'Software (Ezmeral / OpsRamp / Zerto)',
            back: 'The tools layer that sits on top of the hardware. Ezmeral helps run and manage data/AI workloads, OpsRamp monitors and manages IT operations across environments, and Zerto handles disaster recovery and data protection (getting systems back up fast if something breaks).',
          },
          {
            front: 'Networking',
            back: 'The switches, routers, and Wi-Fi that move data between servers, storage, clouds, and users. Now anchored by Juniper Networks plus HPE’s existing Aruba (Intelligent Edge) business. Without this, nothing else talks to anything else.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 3. GreenLake bill simulator
    // --------------------------------------------------------------------
    {
      id: 'bill-simulator',
      navLabel: 'Bill simulator',
      type: 'simulator',
      eyebrow: 'Try it yourself',
      title: 'The GreenLake bill simulator',
      lede: 'GreenLake bills customers for what they actually use each month, not for what they own. Drag the slider to change monthly usage and watch the bill move with it.',
      content: {
        min: 10,
        max: 100,
        step: 5,
        default: 40,
        unit: '% of provisioned capacity used',
        ratePerUnit: 420,
        baseFee: 3000,
        currency: 'USD',
        explanation:
          'This is a simplified model of consumption billing: a small base platform fee plus a rate for every unit of capacity actually consumed that month. Use more, pay more; use less, pay less. Compare that to a traditional upfront purchase, where the customer pays the same amount whether they use 10% or 100% of what they bought.',
        traditionalPurchasePrice: 65000,
        traditionalPurchaseLabel: 'Traditional upfront purchase (fixed, one-time)',
      },
    },

    // --------------------------------------------------------------------
    // 4. Why hybrid cloud exists
    // --------------------------------------------------------------------
    {
      id: 'why-hybrid-cloud',
      navLabel: 'Why hybrid cloud',
      type: 'reasons',
      eyebrow: 'The big question',
      title: 'If public cloud exists, why doesn’t everyone just use it?',
      lede: 'This is the question that explains why HPE’s entire business model exists. Public cloud (AWS, Azure, Google Cloud) is convenient, but it isn’t always the right answer. Four reasons companies keep infrastructure outside the public cloud, or run a mix of both ("hybrid cloud"):',
      content: {
        items: [
          {
            icon: '💰',
            title: 'Cost at scale',
            body: 'Public cloud is cheap to start and expensive to stay on once usage gets large and predictable. At a certain size, owning or leasing dedicated infrastructure can be significantly cheaper than paying public-cloud rates indefinitely.',
          },
          {
            icon: '🔒',
            title: 'Compliance',
            body: 'Regulated industries (banking, healthcare, government) often have rules about exactly where data physically lives and who can access it. Sometimes the only way to satisfy that is to keep the data on infrastructure the company itself controls.',
          },
          {
            icon: '⚡',
            title: 'Latency',
            body: 'Some applications need data processed in milliseconds — a factory floor, a hospital, a trading desk. Sending that data to a faraway public-cloud data center and back can simply be too slow. Keeping compute physically close to where the work happens fixes that.',
          },
          {
            icon: '🏛️',
            title: 'Legacy systems',
            body: 'Large enterprises run software that’s decades old and wasn’t built to run in a public cloud. Rebuilding it is expensive and risky, so it keeps running on infrastructure that looks a lot like what HPE sells.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 5. Where finance comes in
    // --------------------------------------------------------------------
    {
      id: 'where-finance-comes-in',
      navLabel: 'Where finance fits',
      type: 'finance-role',
      eyebrow: 'Why you’re here',
      title: 'Where finance comes in',
      lede: 'Consumption-based businesses like GreenLake are harder to account for and forecast than a simple one-time hardware sale. That gap is exactly where this team adds value.',
      content: {
        items: [
          {
            title: 'Revenue recognition complexity',
            body: 'When a customer buys a server outright, HPE can often recognize that revenue right away. When a customer instead pays monthly based on usage under GreenLake, revenue has to be recognized over time, as it’s actually used and earned. That makes forecasting and reporting meaningfully more complex than a traditional hardware sale.',
          },
          {
            title: 'ARR as the key metric',
            body: 'Annual Recurring Revenue (ARR) becomes the metric everyone watches for consumption and subscription businesses, the same way it matters for any SaaS company. It measures the predictable, recurring run-rate of the business rather than one-time hardware sales, and it’s the number leadership uses to judge how the shift to as-a-service is actually going.',
          },
          {
            title: 'Deal structuring support',
            body: 'Sales teams negotiate consumption commitments, minimums, financing terms, and contract length with customers. Finance partners with them to structure deals that make sense for HPE’s books, not just for winning the deal.',
          },
          {
            title: 'Unit economics',
            body: 'Because GreenLake bills based on usage instead of a flat upfront price, finance has to understand the underlying cost of delivering that capacity, so pricing stays profitable even as usage swings up and down month to month.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 6. Glossary
    // --------------------------------------------------------------------
    {
      id: 'glossary',
      navLabel: 'Glossary',
      type: 'flipgrid',
      eyebrow: 'Reference',
      title: 'Glossary — flip for the definition',
      lede: 'Terms you’ll hear constantly in meetings. Come back to this section any time.',
      content: {
        cards: [
          {
            front: 'GreenLake',
            back: 'HPE’s consumption-based ("as-a-service") platform. Customers pay for what they use each month rather than buying hardware outright.',
          },
          {
            front: 'ARR',
            back: 'Annual Recurring Revenue. The predictable, recurring portion of revenue, annualized. The north-star metric for consumption and subscription businesses.',
          },
          {
            front: 'Compute',
            back: 'Shorthand for processing power — the servers actually doing calculations, running software, or training/serving AI models. "We need more compute" means "we need more processing capacity."',
          },
          {
            front: 'Hybrid Cloud',
            back: 'A mix of public cloud and private/on-prem infrastructure used together, so a company gets public cloud’s flexibility where it makes sense, and dedicated infrastructure where cost, compliance, latency, or legacy systems demand it.',
          },
          {
            front: 'RPO',
            back: 'Remaining Performance Obligations. The dollar value of work HPE has already been contracted (and often paid) for but hasn’t delivered/recognized as revenue yet. A leading indicator of future revenue.',
          },
          {
            front: 'Financial Services (FS)',
            back: 'HPE’s in-house leasing and financing arm. It lets customers spread the cost of hardware over time instead of paying all at once, similar to financing a car instead of buying it in cash.',
          },
        ],
      },
    },
  ],
}

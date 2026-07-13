// ============================================================================
// Copilot & Power BI 101 — content data
// ----------------------------------------------------------------------------
// Same pattern as src/data/hpe101.js: one array of section objects, each with
// a `type` the renderer maps to a component. Edit copy here; no JSX required.
// ============================================================================

export const copilotPowerBi = {
  id: 'copilot-powerbi-101',
  navLabel: 'Copilot & Power BI 101',
  title: 'Copilot & Power BI 101',
  tagline: 'The two tools you’ll use every week for FP&A work — and how to actually use them.',
  icon: '📊',
  estMinutes: 20,
  sections: [
    // --------------------------------------------------------------------
    // 0. Start here / orientation
    // --------------------------------------------------------------------
    {
      id: 'orientation',
      navLabel: 'Start here',
      type: 'intro',
      eyebrow: 'Orientation',
      title: 'Two different tools that get confused constantly',
      content: {
        body: [
          'Microsoft Copilot and Power BI get lumped together because they both show up inside Microsoft 365 and both involve "AI" in some marketing slide somewhere. They do very different jobs.',
          'Copilot is an AI assistant that lives inside apps you already use — Excel, Word, Outlook, Teams. You ask it to do something in plain language (summarize this, explain this formula, draft this email) and it does it inside that app.',
          'Power BI is a data visualization and reporting tool. It connects to data sources (spreadsheets, databases, other systems), lets you build interactive charts and dashboards from that data, and lets you define your own calculations on top of it.',
          'Short version: Copilot helps you do things faster inside the tools you already have open. Power BI is a tool you build things in. The rest of this module goes deep on both, with real finance examples.',
        ],
        bullets: [
          {
            num: '01',
            title: 'Vocabulary',
            body: 'Six Power BI terms you need before anything else makes sense.',
          },
          {
            num: '02',
            title: 'Build a variance visual',
            body: 'Actual vs. budget by department, step by step, including the DAX formula.',
          },
          {
            num: '03',
            title: 'Copilot for FP&A',
            body: 'Explain formulas, draft commentary, summarize threads.',
          },
          {
            num: '04',
            title: 'Prompt cheat sheet + gotchas',
            body: 'Copy-paste prompts and the mistakes everyone makes early on.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 1. Vocabulary flip cards
    // --------------------------------------------------------------------
    {
      id: 'vocabulary',
      navLabel: 'Vocabulary',
      type: 'flipgrid',
      eyebrow: 'Power BI vocabulary',
      title: 'Six words you’ll hear on day one',
      lede: 'Click each card. These six words unlock almost everything else in Power BI.',
      content: {
        cards: [
          {
            front: 'Dataset',
            back: 'The data Power BI is connected to and has loaded in — for example, an export of actuals and budget by department. Everything you build (reports, dashboards, measures) is built on top of a dataset.',
          },
          {
            front: 'Report',
            back: 'A collection of pages full of visuals (charts, tables, cards) built from a dataset. Think of it like a workbook with multiple tabs, each tab telling part of the story.',
          },
          {
            front: 'Dashboard',
            back: 'A single-page, high-level view that can pull "tiles" in from one or more reports. Dashboards are for monitoring at a glance; reports are for digging in.',
          },
          {
            front: 'Visual',
            back: 'One chart, table, or card on a report page — a clustered bar chart, a line chart, a KPI card. A report is just a page full of visuals arranged together.',
          },
          {
            front: 'Measure',
            back: 'A calculation defined on your data using DAX, computed on the fly based on whatever is being viewed — for example, "Variance %" recalculates automatically for whichever department, month, or filter is currently selected.',
          },
          {
            front: 'DAX',
            back: 'Data Analysis Expressions — the formula language Power BI uses to write measures. If you’ve used Excel formulas, the syntax will look familiar, but DAX is aware of your whole data model, not just cells in a row.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 2. Power BI walkthrough — variance analysis visual
    // --------------------------------------------------------------------
    {
      id: 'powerbi-walkthrough',
      navLabel: 'Build a variance chart',
      type: 'walkthrough',
      eyebrow: 'Hands-on walkthrough',
      title: 'Building a variance analysis visual: actual vs. budget by department',
      lede: 'This is the single most common FP&A chart. Here’s the actual sequence of steps to build it in Power BI Desktop.',
      content: {
        steps: [
          {
            title: 'Connect to your data',
            body: 'Home → Get Data → choose your source (Excel workbook, SQL database, SharePoint list — whatever holds your actuals and budget). Load a table that has at least Department, Actual, and Budget columns, ideally by month.',
          },
          {
            title: 'Pick the visual type',
            body: 'On a report page, select the Clustered Bar Chart (or Clustered Column Chart for vertical bars) from the Visualizations pane. This chart type is built for comparing two or more values side by side across categories — exactly what actual-vs-budget needs.',
          },
          {
            title: 'Build the axes',
            body: 'With the empty visual selected, drag Department into the Axis (or Y-axis) field well, then drag both Actual and Budget into the Values field well. Power BI will automatically draw one bar per department for each measure, side by side.',
          },
          {
            title: 'Add a variance % measure using DAX',
            body: 'Right-click your table in the Data pane → New Measure. Name it "Variance %" and enter the formula below, then drag it into a table or a card visual alongside the chart.',
            snippet: 'Variance % = DIVIDE([Actual] - [Budget], [Budget])',
          },
          {
            title: 'Why DIVIDE instead of a plain slash',
            body: 'In DAX, writing ([Actual] - [Budget]) / [Budget] with a plain division sign will throw an error (or a blank/infinite result) the moment Budget is 0 for any department or period — which happens more often than you’d expect (new cost centers, a department with no budget line yet). DIVIDE(numerator, denominator) is a built-in DAX function that safely returns blank instead of erroring out when the denominator is 0, so your visual doesn’t break the first time it hits a zero-budget row.',
          },
          {
            title: 'Format it like a variance, not a raw number',
            body: 'Select the Variance % measure → Measure Tools → Format → Percentage, 1 decimal place. Optionally add conditional formatting (red for unfavorable, green for favorable) so the table reads at a glance instead of requiring mental math.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 3. Copilot walkthrough for FP&A
    // --------------------------------------------------------------------
    {
      id: 'copilot-walkthrough',
      navLabel: 'Copilot for FP&A',
      type: 'walkthrough',
      eyebrow: 'Hands-on walkthrough',
      title: 'Using Copilot for real FP&A tasks',
      lede: 'Three concrete ways this team actually uses Copilot day to day, not hypothetical demo scenarios.',
      content: {
        steps: [
          {
            title: 'Explain an existing formula in Excel',
            body: 'Open the workbook, select the cell with the formula you don’t recognize (someone else’s nested IF, VLOOKUP, or SUMIFS), open Copilot in Excel, and ask it to explain the selected formula in plain language. This is the fastest way to inherit someone else’s model without reverse-engineering it cell by cell.',
            snippet: 'Prompt: "Explain what the formula in the selected cell is doing, step by step."',
          },
          {
            title: 'Draft variance commentary from a data table',
            body: 'Select the range containing your actual-vs-budget table (the same kind of data from the Power BI walkthrough), open Copilot, and ask it to draft commentary highlighting the largest variances. Copilot will produce a first-pass narrative — always read it against the numbers before sending, but it turns a blank page into an edit.',
            snippet: 'Prompt: "Using the selected table, draft 3-4 sentences of variance commentary highlighting the departments with the largest unfavorable variances."',
          },
          {
            title: 'Summarize a long thread before a meeting',
            body: 'In Outlook or Teams, open Copilot on a long email thread or chat and ask for a summary before you walk into a meeting about it. This is especially useful for threads you were cc’d on for weeks but need to catch up on in two minutes, not twenty.',
            snippet: 'Prompt: "Summarize this thread: what was decided, what’s still open, and what do I need to bring to the meeting?"',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 4. Prompt cheat sheet (finance-specific)
    // --------------------------------------------------------------------
    {
      id: 'prompt-cheatsheet',
      navLabel: 'Prompt cheat sheet',
      type: 'cheatsheet',
      eyebrow: 'Copy, paste, adapt',
      title: 'Finance prompt cheat sheet',
      lede: 'Eight prompts an FP&A analyst on this team would actually type, with a one-line note on when to reach for each one.',
      content: {
        prompts: [
          {
            prompt: 'Explain what the formula in the selected cell is doing, step by step.',
            when: 'When you inherit someone else’s model and need to understand a formula before you trust or change it.',
          },
          {
            prompt: 'Using the selected table, draft 3-4 sentences of variance commentary highlighting the largest unfavorable variances.',
            when: 'Right after actuals close, when you need a first-pass narrative for a variance report.',
          },
          {
            prompt: 'Summarize this thread: what was decided, what’s still open, and what do I need to bring to the meeting?',
            when: 'Before joining a meeting on a long email or Teams thread you were only half-following.',
          },
          {
            prompt: 'Write a DAX measure that calculates variance % as (Actual - Budget) / Budget, safely handling a zero budget.',
            when: 'When you know what calculation you want but don’t remember the exact DAX syntax.',
          },
          {
            prompt: 'Check this Excel model for formulas that reference blank cells or break when a value is zero.',
            when: 'Before sharing a model widely, as a quick sanity check for hidden errors.',
          },
          {
            prompt: 'Turn these bullet points into a short executive summary for a monthly business review slide.',
            when: 'When you have the analysis done and need to package it for leadership quickly.',
          },
          {
            prompt: 'Compare this month’s numbers to last month’s and call out anything that changed by more than 10%.',
            when: 'As a first pass before a deeper manual review, to know where to focus your attention.',
          },
          {
            prompt: 'Rewrite this variance commentary to be more concise and lead with the biggest driver first.',
            when: 'When you have a draft (yours or Copilot’s) that’s too long or buries the key point.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 5. Gotchas
    // --------------------------------------------------------------------
    {
      id: 'gotchas',
      navLabel: 'Common gotchas',
      type: 'gotchas',
      eyebrow: 'Save yourself the confusion',
      title: 'Common beginner gotchas',
      lede: 'Everyone hits these in the first few weeks. Knowing them ahead of time saves an afternoon of confused troubleshooting.',
      content: {
        items: [
          {
            title: '"Total" row doesn’t equal the sum of the rows above it',
            body: 'This usually means your measure isn’t a simple SUM — it might be an average, a ratio, or something calculated per-row. Power BI totals recompute the measure’s logic at the total level, they don’t just add up the visible rows. Check what the measure is actually doing before assuming the total is "wrong."',
          },
          {
            title: 'A visual shows blank or "(Blank)" categories',
            body: 'This almost always means there are rows in your data with a missing or null value in whatever field you put on the axis (e.g., a transaction with no department assigned). Fix it in the source data or filter it out, rather than assuming the report is broken.',
          },
          {
            title: 'Changes in Power BI Desktop don’t show up for other people',
            body: 'Editing a report locally only changes your local file. You need to explicitly Publish it back to the Power BI Service for teammates viewing the shared report or dashboard to see your changes.',
          },
          {
            title: 'A measure shows blank until you add the right context',
            body: 'Measures are calculated based on whatever filters/fields surround them. A measure like Variance % can show blank on its own because it needs Department (or whatever your row context is) on the visual to have anything to divide. If a measure looks broken, check whether it has the fields it needs around it first.',
          },
          {
            title: 'Totals look wrong because of the aggregation type, not a bug',
            body: 'If a measure is built as an average or a ratio (like Variance %) rather than a plain sum, the grand total is not "all the row totals added up" — it’s the same ratio recalculated using the totals of Actual and Budget across every department. That’s correct behavior, not an error, but it surprises almost everyone the first time.',
          },
          {
            title: 'Copilot in Excel needs the table actually referenced by name',
            body: 'Copilot works best when your data is a properly named Excel Table (Insert → Table) and your prompt references that name or a clearly selected range — not a loose, unnamed range of cells. If Copilot gives vague or wrong answers, check whether it can actually identify what data you mean first.',
          },
        ],
      },
    },
  ],
}

# timeanalysis

A browser app for **application portfolio rationalisation** with **Gartner's TIME model**: **T**olerate, **I**nvest, **M**igrate, **E**liminate.

Each application gets a 1–5 score on weighted criteria in two dimensions:

| | Low technical fit | High technical fit |
|---|---|---|
| **High business value** | **Migrate**: modernise or re-platform | **Invest**: fund and grow |
| **Low business value** | **Eliminate**: retire | **Tolerate**: keep with minimal spend |

> **Analogy: clearing out a wardrobe.** *Invest* is your favourite jacket in great condition. *Migrate* is the shoes you love but whose soles are worn through: re-sole or replace them. *Tolerate* is a good shirt you rarely wear: keep it, but don't spend on it. *Eliminate* is the torn sweater you haven't worn in years: let it go.

## Features

- **Application inventory**: add, edit, delete, search and sort apps (owner, domain, annual cost, users, lifecycle, notes). Import from CSV.
- **Guided assessment**: score each criterion 1–5. Each criterion has a description and an example of what a 1 and a 5 look like. Live business value / technical fit scores, the TIME result and a completeness meter.
- **Configurable criteria**: rename, re-weight, add or remove criteria, and move the high/low threshold (default 3.0).
- **Decision override** with a recorded rationale, for context the scores can't capture.
- **Dashboard**: KPI tiles (count and spend per quadrant), an interactive TIME matrix (bubble size = cost; click a bubble to assess that app), recommended actions per quadrant, and a portfolio report.
- **Export / share**: CSV report, JSON backup and restore, print to PDF.
- Data is saved automatically in the browser (localStorage). Light and dark mode.

### Default criteria

**Business value**: strategic alignment (25), business criticality (25), functional fit (20), usage & user satisfaction (15), uniqueness / differentiation (15).

**Technical fit**: technology currency (20), maintainability & skills (20), security & compliance (20), reliability & performance (15), integration & architecture fit (15), cost efficiency / TCO (10).

Each dimension's score is the weighted average of the criteria answered so far. A score at or above the threshold counts as *high*.

## Running it

No build step and no server needed: open `index.html` in a browser. To serve it locally instead:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Click **Load sample portfolio** to try it with 12 example applications.

### CSV import format

A header row is required. Only `name` is mandatory:

```csv
name,owner,domain,annualCost,users,lifecycle,notes
Salesforce CRM,Head of Sales,Customer management,420000,850,Mainstream,Core sales platform
```

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Page structure and views |
| `styles.css` | Styling (light/dark themes, print layout) |
| `scoring.js` | TIME scoring engine (weighted scores, classification). Works in the browser and in Node |
| `sample-data.js` | Example portfolio |
| `app.js` | UI: rendering, events, persistence, import/export |
| `test/` | Unit tests for the scoring engine |

## Tests

```bash
node --test
```

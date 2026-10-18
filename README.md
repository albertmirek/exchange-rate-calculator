# Currency calculator

A small web app that shows the exchange rates of the Czech National Bank (CNB)
and converts Czech crowns (CZK) into other currencies.

The rates are downloaded from the CNB's public daily fixing, parsed, cached on
the server and rendered as a table next to a converter.


## How it works

### Data source

The app reads the CNB's
[daily fixing](https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt),
a pipe-delimited text file:

```
15 Oct 2026 #199
Country|Currency|Amount|Code|Rate
Australia|dollar|1|AUD|15.014
Hungary|forint|100|HUF|6.697
```

- The first line holds the date and the sequence number of the fixing.
- `Amount` is not always 1. Some currencies are quoted per 100 or per 1000
  units, so a rate always has to be read together with its amount. The
  conversion will be `CZK amount ÷ rate × quoted amount`.
- The file can only be fetched on the server. The CNB restricts cross-origin
  requests, so the browser cannot download it directly.

### Request flow

1. The home route's loader asks the rates cache for the latest fixing.
2. On the server the cache either answers from memory or fetches and parses the
   CNB file first.
3. The page is server-rendered with the rates, then hydrated in the browser.
4. In the browser the converter calculates the result as the visitor types. It
   needs no further requests. The currency can be chosen in the form or by
   clicking its code in the rates table.

If the rates cannot be loaded at all (CNB is down and nothing is cached yet),
the loader responds with a `503` and the standard error page.

### Parsing

The parser is strict. Any deviation from the documented format (title line,
header, field count, amount, currency code, rate) throws a parse error instead
of returning a partial list. Wrong rates shown to a user are worse than an error.

### Caching

The CNB publishes a new fixing on working days at 14:30 Prague time and the file
only changes once a day, so the app keeps it in memory instead of fetching it
for every visitor.

- **One fetch for everyone.** Concurrent requests share a single download.
- **Refresh after publication.** Once the 14:30 publication time on a working
  day has passed, the next request starts a refresh. At weekends the cache stays
  as it is.
- **Late publication.** If the new fixing has not appeared yet, the app asks
  again, at most every 5 minutes in the first hour after 14:30 and every 30
  minutes after that, until it arrives.
- **Stale data beats waiting.** While a refresh is running, or when it fails,
  visitors get the rates already cached. Only the very first request after a
  start, with nothing cached yet, waits for the CNB.
- **Older fixings never replace newer ones.** A response counts as an update
  only if its date or sequence number is higher.
- **Time zone safe.** The schedule compares Prague wall-clock times, so daylight
  saving changes need no special handling.

The cache lives in the memory of the server process. It is shared by all
visitors of that process and is empty again after a restart or a new deploy.
This suits a long-running Node server.

## Tech stack

- [React](https://react.dev/) 19 and TypeScript
- [React Router](https://reactrouter.com/) 8 in framework mode, with server-side
  rendering
- [Tailwind CSS](https://tailwindcss.com/) 4 for styling
- [Vitest](https://vitest.dev/) for tests
- [pnpm](https://pnpm.io/) as the package manager

### Why Tailwind CSS and not Styled Components

The task brief lists Styled Components. This project uses Tailwind CSS instead,
on purpose:

- **The app is server-rendered.** Styled Components generates its CSS while
  components render. On the server that CSS has to be collected and inserted
  into the streamed HTML, which needs a custom server entry file and extra
  bundler configuration. Without it the page arrives unstyled and only gets its
  styles once JavaScript has loaded.
- **That setup brings nothing to this app.** Tailwind compiles to a static CSS
  file at build time, so the server has nothing to collect and the browser
  receives the styles with the page.
- **Less runtime work.** Static CSS needs no style generation in the server or
  the browser while rendering.
- **A poor fit for where React is going.** Runtime CSS-in-JS works against
  server components and streaming rendering, which is the direction of the
  framework this app is built on.

### Why no React Query

The task brief also lists React Query. This project does not use it, on purpose:

- **The server already fetches and caches.** The route's loader gets the rates
  from the server-side cache and the page is rendered with them. React Query
  would add a second, client-side cache for the same data.
- **It would need a second way to load the data.** The query needs a URL to
  fetch, so the app would get an extra route that returns the rates as JSON,
  next to the loader that already does the same job.
- **The data hardly changes.** The CNB publishes one fixing per working day, so
  there is nothing to poll, deduplicate or retry on the client.
- **The converter needs no fetching.** Converting an amount is arithmetic on
  rates the page already has.

The one thing it could add is refreshing a tab that stays open past the
publication time. React Router can do that on its own by re-running the loader
when the window regains focus, so it can be added later without a new library.


## Project structure

```
app/
├── components/            Presentational components
│   ├── CurrencyConverterForm.tsx   Amount and currency inputs with the result
│   ├── RatesTable.tsx              Table of the exchange rates
│   └── RatesTableRow.tsx           One currency row
├── lib/cnb/               Everything about the CNB data (server only)
│   ├── client.server.ts     Downloads the daily file
│   ├── parse/               Turns the file's text into typed rates
│   ├── schedule/            Publication time and retry timing
│   └── cache/               In-memory cache that ties it all together
├── lib/convert/           CZK to foreign currency conversion
├── routes/
│   └── home.tsx             The page: loader and layout
├── root.tsx               Document shell and error page
└── app.css                Tailwind setup and colour tokens
```

Files ending in `.server.ts` can only run on the server and are never included
in the browser bundle. Tests sit next to the code they cover.

## Getting started

You need Node.js (developed on version 22) and pnpm.

```bash
pnpm install
pnpm dev
```

The app is then available at <http://localhost:5173>.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the development server with hot reloading |
| `pnpm build` | Creates the production build in `build/` |
| `pnpm start` | Serves the production build |
| `pnpm test` | Runs all tests once |
| `pnpm typecheck` | Generates route types and checks the TypeScript code |

## Testing

```bash
pnpm test
```

The tests cover the logic that is easy to get subtly wrong:

- **Parser:** valid files, wrong titles, headers, fields, amounts, codes and
  rates, and the line number in error messages.
- **Schedule:** when a new publication is due and how long to wait between
  retries, including weekends and both daylight saving changes.
- **Cache:** the first request waiting for data, sharing one fetch, serving
  stale rates during a refresh, retry timing, failures, and which fixing wins.
- **Conversion:** currencies quoted per 1, 100 and 1000 units, zero and small
  amounts.
- **Converter form:** typing an amount, a comma as the decimal separator,
  dropping characters that are not part of a number, switching currency and
  clearing the amount. These tests render the component in a simulated browser
  (jsdom).

The cache tests use a fake CNB and a fake clock, so they need no network.

## Deployment

The app is deployed on Vercel: <https://exchange-rate-calculator-beta.vercel.app>

It also runs as a plain Node server (`pnpm build`, then `pnpm start`).

The rates cache lives in the memory of the process. On a long-running server
that is one cache for all visitors. On Vercel the app runs as serverless
functions, so each running instance has its own cache.

The functions run in Frankfurt (`fra1`, set in `vercel.json`), close to the
visitors in Europe.

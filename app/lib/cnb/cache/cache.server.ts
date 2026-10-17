import { fetchDailyRates } from "../client.server";
import type { CnbDailyRates } from "../parse/parse.server";
import { getRetryIntervalMs, hasPublicationSince } from "../schedule/schedule.server";

type CachedRates = { dailyRates: CnbDailyRates; fetchedAt: Date };

function isNewer(candidate: CnbDailyRates, cached: CnbDailyRates): boolean {
  return (
    candidate.date > cached.date ||
    (candidate.date === cached.date && candidate.sequence > cached.sequence)
  );
}

/**
 * In-memory cache of the latest CNB fixing. Refetches only once the data is
 * older than the latest expected publication, retries (rate limited) while
 * the new fixing has not appeared, shares one request between concurrent
 * callers and serves the stale fixing while a fetch runs (or fails). Only
 * the very first call, with nothing cached yet, waits for CNB.
 */
export function createRatesCache(
  fetchRates: () => Promise<CnbDailyRates>,
  now: () => Date = () => new Date(),
) {
  let cachedRates: CachedRates | null = null;
  let lastFetchAttemptAt: Date | null = null;
  let pendingFetch: Promise<void> | null = null;

  /**
   * Stores the fetched rates when they are newer than the cached ones. A failed
   * fetch is logged and swallowed while something is cached, and thrown
   * otherwise.
   */
  async function fetchRatesIntoCache(attemptedAt: Date): Promise<void> {
    lastFetchAttemptAt = attemptedAt;
    try {
      const dailyRates = await fetchRates();
      if (!cachedRates || isNewer(dailyRates, cachedRates.dailyRates)) {
        cachedRates = { dailyRates, fetchedAt: attemptedAt };
        console.info(
          `CNB rates: loaded fixing #${dailyRates.sequence} (${dailyRates.date})`,
        );
      }
    } catch (error) {
      if (!cachedRates) throw error;
      console.error("CNB rates: fetch failed, serving stale fixing", error);
    } finally {
      pendingFetch = null;
    }
  }

  function readCachedRatesOrThrow(): CnbDailyRates {
    if (!cachedRates) throw new Error("No rates cached");
    return cachedRates.dailyRates;
  }

  function isRefreshDue(cached: CachedRates, requestedAt: Date): boolean {
    const isStale = hasPublicationSince(cached.fetchedAt, requestedAt);
    const isRetryAllowed =
      lastFetchAttemptAt === null ||
      requestedAt.getTime() - lastFetchAttemptAt.getTime() >=
        getRetryIntervalMs(requestedAt);

    return isStale && isRetryAllowed;
  }

  return async function getRates(): Promise<CnbDailyRates> {
    const requestedAt = now();

    if (!cachedRates) {
      // Cold start: nothing to serve yet, so wait for the fetch.
      if (!pendingFetch) {
        pendingFetch = fetchRatesIntoCache(requestedAt);
      }
      await pendingFetch;
    } else if (isRefreshDue(cachedRates, requestedAt) && !pendingFetch) {
      // Stale data beats waiting: refresh in the background and serve what we
      // have in the meantime.
      pendingFetch = fetchRatesIntoCache(requestedAt);
    }

    return readCachedRatesOrThrow();
  };
}

export const getRates = createRatesCache(fetchDailyRates);

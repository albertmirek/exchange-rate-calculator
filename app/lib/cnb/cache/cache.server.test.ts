import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CnbDailyRates } from "../parse/parse.server";
import { createRatesCache } from "./cache.server";

// Times are UTC. Prague is two hours ahead in October, so CNB publishes at
// 12:30 UTC. 15 October 2026 is a Thursday.
const THURSDAY_AFTER_PUBLICATION = "2026-10-15T12:35:00Z";
const FRIDAY_JUST_AFTER_PUBLICATION = "2026-10-16T12:31:00Z";

function createDailyRates(date: string, sequence: number): CnbDailyRates {
  return { date, sequence, rates: [] };
}

const THURSDAY_RATES = createDailyRates("2026-10-15", 199);
const FRIDAY_RATES = createDailyRates("2026-10-16", 200);

/** A cache wired to a fake CNB and a clock the test controls. */
function createTestCache() {
  let nowAt = new Date(THURSDAY_AFTER_PUBLICATION);
  let servedRates = THURSDAY_RATES;
  let isCnbDown = false;
  let fetchGate: Promise<void> | null = null;
  let fetchCount = 0;

  const getRates = createRatesCache(
    async () => {
      fetchCount++;
      if (fetchGate) await fetchGate;
      if (isCnbDown) throw new Error("CNB is down");
      return servedRates;
    },
    () => nowAt,
  );

  return {
    getRates,
    getFetchCount: () => fetchCount,
    setNow: (iso: string) => {
      nowAt = new Date(iso);
    },
    publish: (rates: CnbDailyRates) => {
      servedRates = rates;
    },
    setCnbDown: (value: boolean) => {
      isCnbDown = value;
    },
    /** Makes fetches wait until the returned function is called. */
    holdFetches: () => {
      let release!: () => void;
      fetchGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        fetchGate = null;
        release();
      };
    },
  };
}

/** Lets a fetch that nobody awaits finish. */
function waitForBackgroundFetch(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRatesCache", () => {
  describe("with nothing cached", () => {
    it("fetches and returns the rates", async () => {
      const cache = createTestCache();

      expect(await cache.getRates()).toEqual(THURSDAY_RATES);
      expect(cache.getFetchCount()).toBe(1);
    });

    it("waits for the fetch before returning", async () => {
      const cache = createTestCache();
      const release = cache.holdFetches();
      let isReturned = false;

      const pendingRates = cache.getRates().then((rates) => {
        isReturned = true;
        return rates;
      });
      await waitForBackgroundFetch();
      expect(isReturned).toBe(false);

      release();
      expect(await pendingRates).toEqual(THURSDAY_RATES);
    });

    it("shares one fetch between concurrent callers", async () => {
      const cache = createTestCache();

      const results = await Promise.all([
        cache.getRates(),
        cache.getRates(),
        cache.getRates(),
      ]);

      expect(results).toEqual([THURSDAY_RATES, THURSDAY_RATES, THURSDAY_RATES]);
      expect(cache.getFetchCount()).toBe(1);
    });

    it("rejects every concurrent caller when the fetch fails", async () => {
      const cache = createTestCache();
      cache.setCnbDown(true);

      const outcomes = await Promise.allSettled([
        cache.getRates(),
        cache.getRates(),
      ]);

      expect(outcomes.map((outcome) => outcome.status)).toEqual([
        "rejected",
        "rejected",
      ]);
      expect(cache.getFetchCount()).toBe(1);
    });

    it("tries again on the next call after a failure", async () => {
      const cache = createTestCache();
      cache.setCnbDown(true);
      await expect(cache.getRates()).rejects.toThrow("CNB is down");

      cache.setCnbDown(false);

      expect(await cache.getRates()).toEqual(THURSDAY_RATES);
      expect(cache.getFetchCount()).toBe(2);
    });
  });

  describe("while the cached rates are up to date", () => {
    it("serves from the cache without fetching again", async () => {
      const cache = createTestCache();
      await cache.getRates();

      await cache.getRates();
      cache.setNow("2026-10-15T20:00:00Z");
      await cache.getRates();

      expect(cache.getFetchCount()).toBe(1);
    });

    it("does not fetch over the weekend", async () => {
      const cache = createTestCache();
      cache.setNow("2026-10-16T13:00:00Z"); // Friday, after the publication
      await cache.getRates();

      cache.setNow("2026-10-18T10:00:00Z"); // Sunday
      await cache.getRates();

      expect(cache.getFetchCount()).toBe(1);
    });
  });

  describe("once a publication is due", () => {
    it("returns the cached rates without waiting for the refresh", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.holdFetches();
      cache.publish(FRIDAY_RATES);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);

      const rates = await cache.getRates();

      expect(rates).toEqual(THURSDAY_RATES);
      expect(cache.getFetchCount()).toBe(2);
    });

    it("starts only one refresh while it is running", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.holdFetches();
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);
      await cache.getRates();

      // The refresh is still running when the retry interval has passed.
      cache.setNow("2026-10-16T12:37:00Z");
      await Promise.all([cache.getRates(), cache.getRates()]);

      expect(cache.getFetchCount()).toBe(2);
    });

    it("returns the new rates to the next call once the refresh is done", async () => {
      const cache = createTestCache();
      await cache.getRates();
      const release = cache.holdFetches();
      cache.publish(FRIDAY_RATES);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);
      await cache.getRates();

      release();
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(FRIDAY_RATES);
      expect(cache.getFetchCount()).toBe(2);
    });

    it("stops fetching once the new rates are cached", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.publish(FRIDAY_RATES);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);
      await cache.getRates();
      await waitForBackgroundFetch();

      cache.setNow("2026-10-16T18:00:00Z");
      await cache.getRates();
      await waitForBackgroundFetch();

      expect(cache.getFetchCount()).toBe(2);
    });
  });

  describe("while CNB has not published yet", () => {
    it("asks again every 5 minutes in the first hour", async () => {
      const cache = createTestCache();
      await cache.getRates();

      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(2);

      cache.setNow("2026-10-16T12:34:00Z"); // 3 minutes later
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(2);

      cache.setNow("2026-10-16T12:36:30Z"); // 5 minutes later
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(3);
    });

    it("keeps returning the cached rates when CNB serves the same fixing", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);

      await cache.getRates();
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(THURSDAY_RATES);
    });

    it("asks every 30 minutes after the first hour", async () => {
      const cache = createTestCache();
      await cache.getRates();

      cache.setNow("2026-10-16T13:40:00Z"); // 15:40 in Prague
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(2);

      cache.setNow("2026-10-16T14:00:00Z"); // 20 minutes later
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(2);

      cache.setNow("2026-10-16T14:11:00Z"); // 31 minutes later
      await cache.getRates();
      await waitForBackgroundFetch();
      expect(cache.getFetchCount()).toBe(3);
    });
  });

  describe("when a refresh fails", () => {
    it("keeps returning the cached rates and logs the failure", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.setCnbDown(true);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);

      expect(await cache.getRates()).toEqual(THURSDAY_RATES);
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(THURSDAY_RATES);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("picks up the new rates once CNB is back", async () => {
      const cache = createTestCache();
      await cache.getRates();
      cache.setCnbDown(true);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);
      await cache.getRates();
      await waitForBackgroundFetch();

      cache.setCnbDown(false);
      cache.publish(FRIDAY_RATES);
      cache.setNow("2026-10-16T12:37:00Z"); // after the retry interval
      await cache.getRates();
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(FRIDAY_RATES);
    });
  });

  describe("which fixing wins", () => {
    it("does not replace the cached rates with an older fixing", async () => {
      const cache = createTestCache();
      cache.publish(FRIDAY_RATES);
      cache.setNow("2026-10-16T13:00:00Z");
      await cache.getRates();

      cache.publish(THURSDAY_RATES);
      cache.setNow("2026-10-19T13:00:00Z"); // Monday, after the publication
      await cache.getRates();
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(FRIDAY_RATES);
    });

    it("replaces the cached rates with a higher sequence on the same date", async () => {
      const cache = createTestCache();
      await cache.getRates();
      const correctedRates = createDailyRates("2026-10-15", 200);
      cache.publish(correctedRates);
      cache.setNow(FRIDAY_JUST_AFTER_PUBLICATION);

      await cache.getRates();
      await waitForBackgroundFetch();

      expect(await cache.getRates()).toEqual(correctedRates);
    });
  });
});

import { describe, expect, it } from "vitest";
import { getRetryIntervalMs, hasPublicationSince } from "./schedule.server";

// Times carry their Prague UTC offset: +02:00 in summer time, +01:00 in winter
// time. In 2026 summer time ends on Sunday 25 October and starts on Sunday
// 29 March. 16 October 2026 is a Friday.

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

describe("hasPublicationSince", () => {
  describe("on a weekday", () => {
    it.each([
      ["fetched after today's publication", "2026-10-16T15:00:00+02:00", "2026-10-16T16:00:00+02:00"],
      ["fetched exactly at the publication time", "2026-10-16T14:30:00+02:00", "2026-10-16T16:00:00+02:00"],
      ["fetched in the same minute as asked", "2026-10-16T16:00:00+02:00", "2026-10-16T16:00:00+02:00"],
      ["asked before today's publication, fetched since yesterday's", "2026-10-15T15:00:00+02:00", "2026-10-16T10:00:00+02:00"],
      ["asked before today's publication, fetched this morning", "2026-10-16T09:00:00+02:00", "2026-10-16T10:00:00+02:00"],
      ["asked a second before today's publication", "2026-10-15T15:00:00+02:00", "2026-10-16T14:29:59+02:00"],
    ])("is false when %s", (_name, fetchedAt, now) => {
      expect(hasPublicationSince(new Date(fetchedAt), new Date(now))).toBe(false);
    });

    it.each([
      ["fetched this morning, asked after the publication", "2026-10-16T09:00:00+02:00", "2026-10-16T15:00:00+02:00"],
      ["fetched a minute before the publication", "2026-10-16T14:29:00+02:00", "2026-10-16T14:30:00+02:00"],
      ["fetched yesterday, asked after today's publication", "2026-10-15T15:00:00+02:00", "2026-10-16T14:30:00+02:00"],
      ["asked before today's publication, fetched before yesterday's", "2026-10-15T14:00:00+02:00", "2026-10-16T10:00:00+02:00"],
      ["fetched weeks ago", "2026-09-01T12:00:00+02:00", "2026-10-16T10:00:00+02:00"],
    ])("is true when %s", (_name, fetchedAt, now) => {
      expect(hasPublicationSince(new Date(fetchedAt), new Date(now))).toBe(true);
    });
  });

  describe("around a weekend", () => {
    it.each([
      ["Saturday, fetched after Friday's publication", "2026-10-16T15:00:00+02:00", "2026-10-17T12:00:00+02:00"],
      ["Sunday, fetched after Friday's publication", "2026-10-16T15:00:00+02:00", "2026-10-18T12:00:00+02:00"],
      ["Sunday, fetched on Saturday", "2026-10-17T09:00:00+02:00", "2026-10-18T12:00:00+02:00"],
      ["Monday morning, fetched after Friday's publication", "2026-10-16T15:00:00+02:00", "2026-10-19T10:00:00+02:00"],
    ])("is false on %s", (_name, fetchedAt, now) => {
      expect(hasPublicationSince(new Date(fetchedAt), new Date(now))).toBe(false);
    });

    it.each([
      ["Saturday, fetched before Friday's publication", "2026-10-16T10:00:00+02:00", "2026-10-17T12:00:00+02:00"],
      ["Sunday, fetched on Thursday", "2026-10-15T15:00:00+02:00", "2026-10-18T12:00:00+02:00"],
      ["Monday after the publication, fetched on Friday", "2026-10-16T15:00:00+02:00", "2026-10-19T15:00:00+02:00"],
    ])("is true on %s", (_name, fetchedAt, now) => {
      expect(hasPublicationSince(new Date(fetchedAt), new Date(now))).toBe(true);
    });
  });

  describe("across daylight saving changes", () => {
    it("uses winter time after summer time ends", () => {
      // On Monday 26 October Prague is one hour ahead of UTC, so 13:45 UTC is
      // 14:45 (after the publication) and 12:45 UTC is 13:45 (before it).
      const now = new Date("2026-10-26T15:00:00Z");

      expect(hasPublicationSince(new Date("2026-10-26T13:45:00Z"), now)).toBe(false);
      expect(hasPublicationSince(new Date("2026-10-26T12:45:00Z"), now)).toBe(true);
    });

    it("uses summer time after summer time starts", () => {
      // 12:29 UTC on Monday 30 March is 14:29 in summer time.
      const now = new Date("2026-03-30T12:30:00Z");

      expect(hasPublicationSince(new Date("2026-03-30T12:29:00Z"), now)).toBe(true);
      expect(hasPublicationSince(new Date("2026-03-30T12:30:00Z"), now)).toBe(false);
    });

    it("treats a fetch before the change as stale after the next publication", () => {
      const fetchedAt = new Date("2026-03-27T15:00:00+01:00");
      const now = new Date("2026-03-30T14:30:00+02:00");

      expect(hasPublicationSince(fetchedAt, now)).toBe(true);
    });
  });
});

describe("getRetryIntervalMs", () => {
  it.each([
    ["at the publication time", "2026-10-16T14:30:00+02:00"],
    ["in the middle of the first hour", "2026-10-16T15:00:00+02:00"],
    ["a second before the first hour ends", "2026-10-16T15:29:59+02:00"],
    ["after the publication on a Monday", "2026-10-19T14:45:00+02:00"],
  ])("is 5 minutes %s", (_name, now) => {
    expect(getRetryIntervalMs(new Date(now))).toBe(FIVE_MINUTES_MS);
  });

  it.each([
    ["when the first hour ends", "2026-10-16T15:30:00+02:00"],
    ["in the evening", "2026-10-16T20:00:00+02:00"],
    ["before the publication", "2026-10-16T14:29:59+02:00"],
    ["in the morning", "2026-10-16T10:00:00+02:00"],
    ["on a Saturday afternoon", "2026-10-17T14:45:00+02:00"],
    ["on a Sunday afternoon", "2026-10-18T14:45:00+02:00"],
    ["on a Monday before the publication", "2026-10-19T14:00:00+02:00"],
  ])("is 30 minutes %s", (_name, now) => {
    expect(getRetryIntervalMs(new Date(now))).toBe(THIRTY_MINUTES_MS);
  });

  it("follows Prague time after summer time ends", () => {
    // Monday 26 October is in winter time, so 13:45 UTC is 14:45 in Prague.
    expect(getRetryIntervalMs(new Date("2026-10-26T13:45:00Z"))).toBe(FIVE_MINUTES_MS);
    expect(getRetryIntervalMs(new Date("2026-10-26T14:45:00Z"))).toBe(THIRTY_MINUTES_MS);
  });

  it("follows Prague time after summer time starts", () => {
    // Monday 30 March is in summer time, so 12:45 UTC is 14:45 in Prague.
    expect(getRetryIntervalMs(new Date("2026-03-30T12:45:00Z"))).toBe(FIVE_MINUTES_MS);
    expect(getRetryIntervalMs(new Date("2026-03-30T13:45:00Z"))).toBe(THIRTY_MINUTES_MS);
  });
});

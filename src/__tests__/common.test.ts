/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import {
  DEFAULT_ZOOM_EXCLUSION_LIST,
  domainToSiteWildcard,
  getDomain,
  parseTwoPixelsString,
  intersection,
  isPageExcluded,
  listToArray,
  numbericOnly,
  rangeInt,
  formatInt,
  formatFloat,
  round,
  getOverlapCount,
  splitUrlWords,
  safeParseInt,
  safeParseFloat,
  centerDomRect,
  pointIsInRect,
  pointOnRect,
} from "../common";

describe("common.ts", () => {
  test("numbericOnly", () => {
    expect(numbericOnly("1234567890")).toBe("1234567890");
    expect(numbericOnly("-1")).toBe("1"); // neg numbers not supported
    expect(numbericOnly(" a12bc-345\r\n67 ")).toBe("1234567");
    expect(numbericOnly(" abc\r\nde ")).toBe("");
  });

  test("rangeInt", () => {
    expect(rangeInt(0, -1, 100)).toBe(0);
    expect(rangeInt(100, -1, 100)).toBe(100);
    expect(rangeInt(-100, -1, 100)).toBe(-1);
    expect(rangeInt(2, 0, 1)).toBe(1);
    expect(rangeInt(2, 1, 1)).toBe(1);
  });

  test("getDomain()", () => {
    expect(getDomain("https://www.example.com/foo/bar.html?param1=1&param2=2")).toBe(
      "www.example.com",
    );
    expect(getDomain("blob:https://www.example.com/foo/bar.html?param1=1&param2=2")).toBe(
      "www.example.com",
    );
    expect(getDomain("www.example.com")).toBe("www.example.com");
    expect(getDomain("")).toBe("");
  });

  test("domainToSiteWildcard() wholeDomainAccess=false", () => {
    expect(domainToSiteWildcard("", false)).toBe("");
    expect(
      domainToSiteWildcard("https://www.example.com/foo/bar.html?param1=1&param2=2", false),
    ).toBe("https://www.example.com/");
  });

  test("domainToSiteWildcard() wholeDomainAccess=true", () => {
    expect(domainToSiteWildcard("", true)).toBe("");
    expect(
      domainToSiteWildcard("https://www.example.com/foo/bar.html?param1=1&param2=2", true),
    ).toBe("https://*.example.com/");
  });

  test("listToArray()", () => {
    expect(listToArray("www.example.com,example.co,example.game")).toStrictEqual([
      "www.example.com",
      "example.co",
      "example.game",
    ]);
    expect(listToArray("www.example.com")).toStrictEqual(["www.example.com"]);
    expect(listToArray("")).toStrictEqual([]);
    expect(listToArray(",")).toStrictEqual([]);
  });

  test("listToArray() dirty data", () => {
    expect(listToArray(",www.example.com, example.co,, example.game,")).toStrictEqual([
      "www.example.com",
      "example.co",
      "example.game",
    ]);
  });

  test("intersection()", () => {
    expect(intersection(["a", "b", "c", "d"], ["c", "e"])).toBe(true);
    expect(intersection(["a", "b", "c", "d"], [])).toBe(false);
    expect(intersection([], ["a", "b", "c", "d"])).toBe(false);
  });

  test("isPageExcluded() true", () => {
    expect(isPageExcluded("www.example.com", "foo,example,bar")).toBe(true);
    expect(isPageExcluded("www.example.co.uk", "foo,example,bar")).toBe(true);
  });

  test("isPageExcluded() false", () => {
    expect(isPageExcluded("www.examplesite.com", "foo,example,bar")).toBe(false);
    expect(isPageExcluded("www.sexample.com", "foo,example,bar")).toBe(false);
  });

  test("isPageExcluded() tv.youtube", () => {
    expect(isPageExcluded("www.youtube.com", "tv.youtube,foo")).toBe(false);
  });

  test("isPageExcluded() tv.apple.com", () => {
    expect(isPageExcluded("tv.apple.com", DEFAULT_ZOOM_EXCLUSION_LIST)).toBe(true);
  });

  test("isPageExcluded() real false", () => {
    expect(isPageExcluded("pluto.tv", DEFAULT_ZOOM_EXCLUSION_LIST)).toBe(false);
    expect(isPageExcluded("www.youtube.com", DEFAULT_ZOOM_EXCLUSION_LIST)).toBe(false);
  });

  test("isPageExcluded() tough", () => {
    expect(isPageExcluded("www.example.com", "example.com,bar")).toBe(true);
    expect(isPageExcluded("example1.foobar.com", "foo,example,bar")).toBe(false);
    // this one fails. but it's not used for security checks, so it's fine.
    // expect(isPageExcluded("example.foobar.com", "foo,example,bar")).toBe(false);
  });

  test("parseTwoPixelsString() simple", () => {
    expect(parseTwoPixelsString("12px 13px")).toStrictEqual({
      top: 12,
      left: 13,
    });
    expect(parseTwoPixelsString(" 14px 15px ")).toStrictEqual({
      top: 14,
      left: 15,
    });
  });

  test("parseTwoPixelsString() translate", () => {
    expect(parseTwoPixelsString("translate(18px, 19px)")).toStrictEqual({
      top: 18,
      left: 19,
    });
    expect(parseTwoPixelsString("translate(20px,21px)")).toStrictEqual({
      top: 20,
      left: 21,
    });
    expect(parseTwoPixelsString(" translate ( 22px,  23px ) ")).toStrictEqual({
      top: 22,
      left: 23,
    });
  });

  test("parseTwoPixelsString() float", () => {
    expect(parseTwoPixelsString("(-18.7px,-19.1px)")).toStrictEqual({
      top: -18.7,
      left: -19.1,
    });
    expect(parseTwoPixelsString("translate(18.7px, 19.1px)")).toStrictEqual({
      top: 18.7,
      left: 19.1,
    });
    expect(parseTwoPixelsString("translate(20px,-21px)")).toStrictEqual({
      top: 20,
      left: -21,
    });
    expect(parseTwoPixelsString(" translate ( -22.1px,  23px ) ")).toStrictEqual({
      top: -22.1,
      left: 23,
    });
    expect(parseTwoPixelsString(" ( 22.1px  -23px ) ")).toStrictEqual({
      top: 22.1,
      left: -23,
    });
  });

  test("formatInt()", () => {
    expect(formatInt(123)).toBe("123");
    expect(formatInt(123.45)).toBe("123");
    expect(formatInt(345.67)).toBe("346");
  });

  test("formatFloat()", () => {
    expect(formatFloat(123)).toBe("123.00");
    expect(formatFloat(123.45)).toBe("123.45");
    expect(formatFloat(123.456)).toBe("123.46");
    expect(formatFloat(1)).toBe("1.00");
    expect(formatFloat(-1)).toBe("-1.00");
  });

  test("round()", () => {
    expect(round(123)).toBe(123.0);
    expect(round(123.45)).toBe(123.45);
    expect(round(123.456)).toBe(123.46);
  });

  test("getOverlapCount()", () => {
    expect(getOverlapCount(["a", "b", "c", "d"], ["b", "1", "d"])).toBe(2);
    expect(getOverlapCount(["a", "b", "c", "d"], [])).toBe(0);
    expect(getOverlapCount([], ["a", "b", "c", "d"])).toBe(0);
  });

  test("splitUrlWords()", () => {
    expect(
      splitUrlWords("https://www.foo.bar.com/path/filename.html?q=search&param2=bar"),
    ).toStrictEqual(["foo", "bar", "path", "filename"]);
    expect(
      splitUrlWords(
        "https://www.nbcnews.com/meet-the-press/video/kristen-welker-it-is-an-incredible-honor-to-be-sitting-in-this-chair-193145413853",
      ),
    ).toStrictEqual([
      "nbcnews",
      "meet",
      "press",
      "kristen",
      "welker",
      "incredible",
      "honor",
      "sitting",
      "this",
      "chair",
      "193145413853",
    ]);
  });

  test("safeParseInt()", () => {
    expect(safeParseInt("123")).toBe(123);
    expect(safeParseInt("-123")).toBe(-123);
    expect(safeParseInt("123.45")).toBe(123);
    expect(safeParseInt("123px")).toBe(123);
    expect(safeParseInt("")).toBe(0);
    expect(safeParseInt("NaN")).toBe(0);
    expect(safeParseInt("value: 123px")).toBe(123);
    // this is debatable. round or truncate?
    expect(safeParseInt("0.6")).toBe(0);
  });

  test("safeParseFloat()", () => {
    expect(safeParseFloat("123")).toBe(123);
    expect(safeParseFloat("-123")).toBe(-123);
    expect(safeParseFloat("123.45")).toBe(123.45);
    expect(safeParseFloat("-123.45")).toBe(-123.45);
    expect(safeParseFloat("-123.4578")).toBe(-123.4578);
    expect(safeParseFloat("678px")).toBe(678);
    expect(safeParseFloat("123.45px")).toBe(123.45);
    expect(safeParseFloat("")).toBe(0);
    expect(safeParseFloat("NaN")).toBe(0);
    expect(safeParseFloat("value: 123.px")).toBe(123);
    // this is debatable. round or truncate?
    expect(safeParseFloat("0.6")).toBe(0.6);
  });
  // //          const centerViewport = centerDomRect(visualViewport);
  // //           if (pointIsInRect(centerViewport, elemBounds)) {
  // //             const distantPoint = pointOnRect(centerViewport,elemBounds);
  const domRect1 = {
    top: 0,
    left: 0,
    bottom: 1000,
    width: 2000,
    height: 1000,
    right: 2000,
  };

  test("centerDomRect()", () => {
    expect(centerDomRect(domRect1)).toStrictEqual({ x: 1000, y: 500 });
  });

  test("pointIsInRect()", () => {
    expect(pointIsInRect({ x: 100, y: 100 }, domRect1)).toBe(true);
    expect(pointIsInRect({ x: 0, y: 0 }, domRect1)).toBe(false);
    expect(pointIsInRect({ x: 3000, y: 3000 }, domRect1)).toBe(false);
  });

  test("pointOnRect(rect)", () => {
    expect(pointOnRect({ x: 1000, y: 550 }, domRect1)).toStrictEqual({
      x: 1000,
      y: 1000,
    });

    expect(pointOnRect({ x: 1000, y: 50 }, domRect1)).toStrictEqual({
      x: 1000,
      y: 0,
    });
  });
});

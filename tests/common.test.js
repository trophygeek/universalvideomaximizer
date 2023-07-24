// tests/demo.js
import { test } from "uvu";
import * as assert from "uvu/assert";
import {
  DEFAULT_ZOOM_EXCLUSION_LIST, domainToSiteWildcard,
  getDomain,
  intersection,
  isPageExcluded,
  listToArray,
  numbericOnly,
  rangeInt,
} from "../src/common";

test("numbericOnly", () => {
  assert.is(numbericOnly("1234567890"), "1234567890");
  assert.is(numbericOnly("-1"), "1"); // neg numbers not supported
  assert.is(numbericOnly(" a12bc-345\r\n67 "), "1234567");
  assert.is(numbericOnly(" abc\r\nde "), "");
});

test("rangeInt", () => {
  assert.is(rangeInt(0, -1, 100), 0);
  assert.is(rangeInt(100, -1, 100), 100);
  assert.is(rangeInt(-100, -1, 100), -1);
  assert.is(rangeInt(2, 0, 1), 1);
  assert.is(rangeInt(2, 1, 1), 1);
});

test("getDomain()", () => {
  assert.is(getDomain("https://www.example.com/foo/bar.html?param1=1&param2=2"), "www.example.com");
  assert.is(getDomain("blob:https://www.example.com/foo/bar.html?param1=1&param2=2"),
    "www.example.com");
  assert.is(getDomain("www.example.com"), "www.example.com");
  assert.is(getDomain(""), "");
});

test("domainToSiteWildcard() wholeDomainAccess=false", () => {
  assert.is(domainToSiteWildcard("", false), "");
  assert.is(domainToSiteWildcard("https://www.example.com/foo/bar.html?param1=1&param2=2", false),
    "https://www.example.com/");
});

test("domainToSiteWildcard() wholeDomainAccess=true", () => {
  assert.is(domainToSiteWildcard("", true), "");
  assert.is(domainToSiteWildcard("https://www.example.com/foo/bar.html?param1=1&param2=2", true),
    "https://*.example.com/");
});

test("listToArray()", () => {
  assert.equal(listToArray("www.example.com,example.co,example.game"),
    ["www.example.com", "example.co", "example.game"]);
  assert.equal(listToArray("www.example.com"),
    ["www.example.com"]);
  assert.equal(listToArray(""), []);
  assert.equal(listToArray(","), []);
});

test("listToArray() dirty data", () => {
  assert.equal(listToArray(",www.example.com, example.co,, example.game,"), [
    "www.example.com",
    "example.co",
    "example.game",
  ]);
});

test("intersection()", () => {
  assert.is(intersection(["a","b","c","d"], ["c","e"]), true);
  assert.is(intersection(["a","b","c","d"], []), false);
  assert.is(intersection([], ["a","b","c","d"]), false);
});

test("isPageExcluded() true", () => {
  assert.is(isPageExcluded("www.example.com", "foo,example,bar"), true);
  assert.is(isPageExcluded("www.example.co.uk", "foo,example,bar"), true);
});

test("isPageExcluded() false", () => {
  assert.is(isPageExcluded("www.examplesite.com", "foo,example,bar"), false);
  assert.is(isPageExcluded("www.sexample.com", "foo,example,bar"), false);
});

test("isPageExcluded() real", () => {
  assert.is(isPageExcluded("tv.apple.com", DEFAULT_ZOOM_EXCLUSION_LIST), true);
});

test("isPageExcluded() tough", () => {
  // this is a mistake!
  assert.is(isPageExcluded("www.example.com", "example.com,bar"), false);
  assert.is(isPageExcluded("example1.foobar.com", "foo,example,bar"), false);
  assert.is(isPageExcluded("example.foobar.com", "foo,example,bar"), true);
});

test.run();

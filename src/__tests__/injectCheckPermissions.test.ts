/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { injectCheckPermissions } from "../injectCheckPermissions";
import { MIN_IFRAME_WIDTH, MIN_IFRAME_HEIGHT, PERMISSIONS_CHECK_DOMAINS_DOC_ATTR } from "../common";

// Store original document to restore after tests
const originalDocument = global.document;

describe("injectCheckPermissions - MIN_IFRAME_HEIGHT bug fix", () => {
  beforeEach(() => {
    // Create a mock document.body with configurable properties
    const mockBody = {
      scrollWidth: 400,
      scrollHeight: 300,
      getAttribute: jest.fn(),
    };

    // Mock document
    (global as any).document = {
      body: mockBody,
    };
  });

  afterEach(() => {
    // Restore original document
    (global as any).document = originalDocument;
    jest.clearAllMocks();
  });

  test("should use MIN_IFRAME_WIDTH for width check and MIN_IFRAME_HEIGHT for height check", () => {
    // Set up: width is below threshold (should return empty)
    (global as any).document.body.scrollWidth = MIN_IFRAME_WIDTH - 1; // 319
    (global as any).document.body.scrollHeight = 500; // Above height threshold

    const result = injectCheckPermissions();
    expect(result).toEqual([]);
    expect((global as any).document.body.getAttribute).not.toHaveBeenCalled();
  });

  test("should use MIN_IFRAME_HEIGHT (240) for height check, not MIN_IFRAME_WIDTH (320)", () => {
    // This test verifies the bug fix: height should use MIN_IFRAME_HEIGHT (240), not MIN_IFRAME_WIDTH (320)
    // Set up: width is above threshold, height is between 240-320
    (global as any).document.body.scrollWidth = 400; // Above width threshold (320)
    (global as any).document.body.scrollHeight = 250; // Between MIN_IFRAME_HEIGHT (240) and MIN_IFRAME_WIDTH (320)

    // With the bug (using MIN_IFRAME_WIDTH for height), this would incorrectly return []
    // With the fix (using MIN_IFRAME_HEIGHT for height), this should proceed normally
    (global as any).document.body.getAttribute.mockReturnValue("example.com");

    const result = injectCheckPermissions();
    
    // Should NOT return empty array because height (250) >= MIN_IFRAME_HEIGHT (240)
    expect(result).not.toEqual([]);
    expect((global as any).document.body.getAttribute).toHaveBeenCalledWith(PERMISSIONS_CHECK_DOMAINS_DOC_ATTR);
  });

  test("should return empty array when height is below MIN_IFRAME_HEIGHT", () => {
    (global as any).document.body.scrollWidth = 400; // Above width threshold
    (global as any).document.body.scrollHeight = MIN_IFRAME_HEIGHT - 1; // 239, below height threshold

    const result = injectCheckPermissions();
    expect(result).toEqual([]);
    expect((global as any).document.body.getAttribute).not.toHaveBeenCalled();
  });

  test("should return empty array when width is below MIN_IFRAME_WIDTH", () => {
    (global as any).document.body.scrollWidth = MIN_IFRAME_WIDTH - 1; // 319
    (global as any).document.body.scrollHeight = 500; // Above height threshold

    const result = injectCheckPermissions();
    expect(result).toEqual([]);
    expect((global as any).document.body.getAttribute).not.toHaveBeenCalled();
  });

  test("should process domains when both width and height are above thresholds", () => {
    (global as any).document.body.scrollWidth = 400; // Above MIN_IFRAME_WIDTH (320)
    (global as any).document.body.scrollHeight = 300; // Above MIN_IFRAME_HEIGHT (240)
    (global as any).document.body.getAttribute.mockReturnValue("example.com,test.com");

    const result = injectCheckPermissions();
    expect(result).toEqual(["example.com", "test.com"]);
    expect((global as any).document.body.getAttribute).toHaveBeenCalledWith(PERMISSIONS_CHECK_DOMAINS_DOC_ATTR);
  });

  test("should handle edge case: height exactly at MIN_IFRAME_HEIGHT threshold", () => {
    (global as any).document.body.scrollWidth = 400;
    (global as any).document.body.scrollHeight = MIN_IFRAME_HEIGHT; // Exactly 240
    (global as any).document.body.getAttribute.mockReturnValue("example.com");

    const result = injectCheckPermissions();
    // Should proceed (not return empty) because height (240) >= MIN_IFRAME_HEIGHT (240)
    expect(result).not.toEqual([]);
    expect((global as any).document.body.getAttribute).toHaveBeenCalled();
  });

  test("should handle edge case: height between MIN_IFRAME_HEIGHT and MIN_IFRAME_WIDTH", () => {
    // This test specifically checks that height uses MIN_IFRAME_HEIGHT, not MIN_IFRAME_WIDTH
    // If height were compared against MIN_IFRAME_WIDTH (320), a height of 250 would incorrectly pass
    // But we want to ensure it uses MIN_IFRAME_HEIGHT (240) for the comparison
    (global as any).document.body.scrollWidth = 400;
    (global as any).document.body.scrollHeight = 250; // Between 240 and 320
    (global as any).document.body.getAttribute.mockReturnValue("example.com");

    const result = injectCheckPermissions();
    // Should proceed because 250 >= 240 (MIN_IFRAME_HEIGHT)
    expect(result).not.toEqual([]);
    expect((global as any).document.body.getAttribute).toHaveBeenCalled();
  });
});

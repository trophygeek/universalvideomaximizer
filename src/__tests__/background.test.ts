/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";

describe("background.ts - processIFrameExtraPermissionsResult merge bug fix", () => {
  test("verify fix: mergeIntoExistingData.subFramesStr is updated before setSubframeData call", () => {
    // Read the source file to verify the fix is in place
    const backgroundPath = join(__dirname, "../background.ts");
    const sourceCode = readFileSync(backgroundPath, "utf-8");

    // Find the relevant section around line 914-917
    const lines = sourceCode.split("\n");
    const relevantLines: string[] = [];
    let inRelevantSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("const subFramesStr = [...new Set(combinedDomainParts)].join(\",\")")) {
        inRelevantSection = true;
      }
      if (inRelevantSection) {
        relevantLines.push(line);
        // Stop after we find setSubframeData call
        if (line.includes("setSubframeData(mergeIntoExistingData)")) {
          break;
        }
      }
    }

    const codeSection = relevantLines.join("\n");

    // Verify the fix: mergeIntoExistingData.subFramesStr should be assigned before setSubframeData
    expect(codeSection).toContain("mergeIntoExistingData.subFramesStr = subFramesStr");
    expect(codeSection).toContain("setSubframeData(mergeIntoExistingData)");

    // Verify the assignment happens before the function call
    const assignmentIndex = codeSection.indexOf("mergeIntoExistingData.subFramesStr = subFramesStr");
    const functionCallIndex = codeSection.indexOf("setSubframeData(mergeIntoExistingData)");
    expect(assignmentIndex).toBeGreaterThan(-1);
    expect(functionCallIndex).toBeGreaterThan(-1);
    expect(assignmentIndex).toBeLessThan(functionCallIndex);
  });

  test("verify fix: code structure is correct", () => {
    const backgroundPath = join(__dirname, "../background.ts");
    const sourceCode = readFileSync(backgroundPath, "utf-8");

    // Check that the fix is present: the assignment should be there
    expect(sourceCode).toContain("mergeIntoExistingData.subFramesStr = subFramesStr");
    
    // Verify it's in the right context (after the Set dedup and before setSubframeData)
    const fixPattern = /const subFramesStr = \[\.\.\.new Set\(combinedDomainParts\)\]\.join\(","\);\s+if \(mergeIntoExistingData\.subFramesStr !== subFramesStr\) \{[^}]*mergeIntoExistingData\.subFramesStr = subFramesStr[^}]*setSubframeData\(mergeIntoExistingData\)/s;
    expect(sourceCode).toMatch(fixPattern);
  });

  test("verify toggleZoomState has proper return after DoZoom in !isActiveState block", () => {
    const backgroundPath = join(__dirname, "../background.ts");
    const sourceCode = readFileSync(backgroundPath, "utf-8");

    // Verify that the permission check logic is INSIDE the !isActiveState block
    // The pattern should be: if (!isActiveState(state)) { ... await DoZoom(...); ... doInjectCheckPermissions(...); ... return ... }
    // We need to match across multiple lines, so we use a more flexible pattern
    const ifBlockPattern = /if\s*\(!isActiveState\(state\)\)\s*\{([\s\S]*?)\n\s*\}\s*\n\s*\/\/\s*we are zoomed but/s;
    const match = sourceCode.match(ifBlockPattern);
    
    expect(match).not.toBeNull();
    expect(match![1]).toBeDefined();
    
    const ifBlockContent = match![1];
    
    // The if block should contain DoZoom, permission check, and return statements
    expect(ifBlockContent).toContain("await DoZoom");
    expect(ifBlockContent).toContain("doInjectCheckPermissions");
    expect(ifBlockContent).toMatch(/return\s+true/);
    
    // Verify that the permission check happens AFTER DoZoom
    const doZoomIndex = ifBlockContent.indexOf("await DoZoom");
    const permissionCheckIndex = ifBlockContent.indexOf("doInjectCheckPermissions");
    expect(doZoomIndex).toBeGreaterThan(-1);
    expect(permissionCheckIndex).toBeGreaterThan(-1);
    expect(permissionCheckIndex).toBeGreaterThan(doZoomIndex);
    
    // Verify there's a return statement after the permission check
    const returnAfterPermission = ifBlockContent.substring(permissionCheckIndex).match(/return\s+true/);
    expect(returnAfterPermission).not.toBeNull();
  });
});

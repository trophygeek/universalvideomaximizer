/*
  Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import { logtrace } from "./common";

/**
 * needed because we cannot include a chrome reference css for a file:// or
 * if the CSP is too strict. Fallback it to inject from background task.
 */
export function injectIsCssHeaderIsBlocked(cssHRef: string): boolean {
  let isBlocked = true; // default to failed.
  try {
    for (let ii = document.styleSheets?.length || 0; ii >= 0; ii--) {
      // we loop backward because our is most likely last.
      if (document.styleSheets[ii]?.href === cssHRef) {
        // try to access the rules to see if it loaded correctly
        try {
          isBlocked = document.styleSheets[ii].cssRules?.length === 0;
        } catch (_err) {}
        break;
      }
    }
  } catch (_err) {}
  if (isBlocked) {
    logtrace(`VideoMaxExt injectIsCssHeaderIsBlocked: css include file blocked?`);
  }
  return isBlocked;
}

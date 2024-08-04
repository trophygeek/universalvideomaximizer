/*
 Video Maximizer

 Copyright (c) 2023-2024. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 */

import { logtrace } from "./common";

export function injectCheckPermissions(): string[] {
  const resultCrossDomainErrs: Set<string> = new Set<string>(); // use Set to dedup
  const allIFrames = document.querySelectorAll("iframe");
  for (const frame of [...allIFrames]) {
    try {
      const { contentDocument } = frame;
      if (!contentDocument) {
        continue;
      }
      // we because we EXPECT to get errors thrown for cross-frame security
      const result = [...contentDocument.body.querySelectorAll("video")];
      if (result.length) {
        // we've got to do something with the result to keep the tree shaking from removing?
        window._videomax_permissioncheck = [...(window._videomax_permissioncheck ?? []), ...result];
      }
    } catch (err) {
      // We record this url access that failed and ask for permission to it
      // but this is run in the context of the page see GET_IFRAME_PERMISSIONS
      if (
        frame instanceof HTMLIFrameElement &&
        frame?.src?.length &&
        document?._VideoMaxExt?.matchedVideo?.nodeName === "IFRAME"
      ) {
        const url = frame?.src;
        if (
          url.startsWith("https://") &&
          (document._VideoMaxExt.matchedVideo instanceof HTMLVideoElement ||
            document._VideoMaxExt.matchedVideo instanceof HTMLIFrameElement)
        ) {
          const domain = new URL(url).host.toLowerCase();
          const iframeUrl = document._VideoMaxExt.matchedVideo.src?.toLowerCase() || "";
          if (iframeUrl.indexOf(domain) !== -1) {
            resultCrossDomainErrs.add(domain);
            logtrace(`VideoMax speed error Need access to ${domain}`);
          }
        }
      }
    }
  }
  return [...resultCrossDomainErrs]; // Set->array
}

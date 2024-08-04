/*
 Video Maximizer

 Copyright (c) 2023-2024. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 */

import {logtrace} from "./common";

export function injectCheckPermissions(): string[] {
  const matchedIFrame = document?._VideoMaxExt?.matchedVideo?.nodeName === "IFRAME" ||
                        window?._VideoMaxExt?.matchedVideo?.nodeName === "IFRAME";
  if (!matchedIFrame) {
    return [];
  }

  const resultCrossDomainErrs: Set<string> = new Set<string>(); // use Set to dedup
  function addresult(frame: HTMLIFrameElement) {
    // We record this url access that failed and ask for permission to it
    // but this is run in the context of the page see GET_IFRAME_PERMISSIONS
    if (frame instanceof HTMLIFrameElement &&
        frame?.src?.length) {
      const url = frame?.src;
      if (url.startsWith("https://")) {
        const domain = new URL(url).host.toLowerCase();
        // const iframeUrl = document._VideoMaxExt.matchedVideo.src?.toLowerCase() || "";
        // if (iframeUrl.indexOf(domain) !== -1) {
        resultCrossDomainErrs.add(domain);
        logtrace(`VideoMax injectCheckPermissions Need access to ${domain}`);
        // }
      }
    }
  }

  debugger;
  const allIFrames = document.querySelectorAll("iframe");
  for (const eachframe of [...allIFrames]) {
    try {
      const {contentDocument} = eachframe;
      if (!contentDocument) {
        addresult(eachframe);
        continue;
      }
      // we because we EXPECT to get errors thrown for cross-frame security
      const results = [...contentDocument.body.querySelectorAll("video")];
      // add videos if on different domain?
      for (const eachVideo of results) {
        // duplicate code, just a test
        const url = eachVideo?.src;
        if (url.startsWith("https://")) {
          const domain = new URL(url).host.toLowerCase();
          resultCrossDomainErrs.add(domain);
          logtrace(`VideoMax injectCheckPermissions Need access to ${domain}`);
        }
      }
    } catch (err) {
      addresult(eachframe);
    }
  }
  return [...resultCrossDomainErrs]; // Set->array
}

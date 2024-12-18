/*
 Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import { findVideosAtCenter, isVideoElement, logtrace } from "./common.js"; // .js embeds the contents

/**
 * Negative numbers means skip backwards
 */
export function injectVideoSkip(skipSecondsStr: string): boolean {
  let skippedResult = false;
  try {
    const skipSeconds = parseFloat(skipSecondsStr);
    const doSkip = (videoElem: HTMLVideoElement) => {
      // restore playback speed after we skip
      const savedSpeed = videoElem.playbackRate || 1.0;
      logtrace(`injectVideoSkip restore savedspeed="${savedSpeed}" after skip`);
      // don't go negative;
      videoElem.currentTime = Math.max(0, videoElem.currentTime + skipSeconds);
      videoElem.playbackRate = savedSpeed;
      skippedResult = true;
    };

    const topVisVideos = findVideosAtCenter(document.body);
    for (const eachVideo of topVisVideos) {
      if ((eachVideo?.seekable?.length || 0) <= 0) {
        continue;
      }
      doSkip(eachVideo);
      break; // for MBA, if we do ALL the videos then skipping ads will skip main video
    }

    if (!skippedResult) {
      // fallback
      const anyVideos = document.querySelectorAll("video");
      for (const eachVideo of anyVideos) {
        if ((eachVideo?.seekable?.length || 0) <= 0) {
          continue;
        }
        doSkip(eachVideo);
        break;
      }
      if (!skippedResult) {
        const videoMaxGlobal = window?._VideoMaxExt ?? document._VideoMaxExt;
        if (videoMaxGlobal && isVideoElement(videoMaxGlobal.matchedVideo)) {
          doSkip(videoMaxGlobal.matchedVideo);
        }
      }
      if (!skippedResult) {
        logtrace("injectVideoSkip no videos found");
      }
    }
  } catch (err) {
    logtrace(`injectVideoSkip err for video`, err);
  }
  return skippedResult;
}

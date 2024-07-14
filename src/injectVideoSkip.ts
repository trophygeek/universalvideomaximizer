/*
 Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import {findVideosAtCenter, logtrace} from "./common.js"; // .js embeds the contents

/**
 * Negative numbers means skip backwards
 */
export function injectVideoSkip(skipSecondsStr: string) {
  const skipSeconds = parseFloat(skipSecondsStr);
  try {
    const topVisVideos = findVideosAtCenter(document.body);
    for (const eachVideo of topVisVideos) {
      if ((eachVideo?.seekable?.length || 0) <= 0) {
        continue;
      }

      // restore playback speed after we skip
      const savedSpeed = eachVideo.playbackRate || 1.0;
      logtrace(`injectVideoSkip savedspeed="${savedSpeed}"`);
      // don't go negative;
      eachVideo.currentTime = Math.max(0, eachVideo.currentTime + skipSeconds);
      eachVideo.playbackRate = savedSpeed;
      break; // for MBA, if we do ALL the videos then skipping ads will skip main video
    }
  } catch (err) {
    console.warn(`VideoMaxExt: injectVideoSkip err for video`, err);
  }
}

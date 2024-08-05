/*
 Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

import {
  DEFAULT_SPEED_NUM,
  findVideosAtCenter,
  formatFloat,
  logerr,
  PLAYBACK_SPEED_ATTR,
} from "./common.js"; // .js embeds the contents

// the current speed as a string, negative is paused
export function injectGetPlaypackSpeed(): string | null {
  try {
    let allpaused = false;
    const topVisVideos = findVideosAtCenter(document?.body);
    for (const eachVideo of topVisVideos) {
      if (eachVideo.playbackRate !== DEFAULT_SPEED_NUM) {
        // we found a video NOT playing at the default rate, so that's what we use.
        const rate = eachVideo.paused ? eachVideo.playbackRate * -1 : eachVideo.playbackRate;
        const result = formatFloat(rate);
        document.body.setAttribute(PLAYBACK_SPEED_ATTR, result);
        return result;
      }
      allpaused = allpaused && eachVideo.paused;
    }

    // We reach here and all the videos are default. Sanity check if paused.
    if (allpaused) {
      const result = formatFloat(-1.0);
      document.body.setAttribute(PLAYBACK_SPEED_ATTR, result);
      return result;
    }

    // Return null in case another frame contains a video.
    if (document?.body?.getAttribute(PLAYBACK_SPEED_ATTR)) {
      document.body.removeAttribute(PLAYBACK_SPEED_ATTR);
    }

    return null;
  } catch (err) {
    logerr("injectGetPlaypackSpeed error: ", err);
    return null;
  }
}

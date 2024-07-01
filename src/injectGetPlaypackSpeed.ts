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
  DEFAULT_SPEED_STR,
  findVideosAtCenter,
  formatFloat,
  logerr,
  PLAYBACK_SPEED_ATTR,
} from "./common";

export function injectGetPlaypackSpeed(): string {
  try {
    // we stash the current injected speed in the body as an attr.
    const attrValue = document?.body?.getAttribute(PLAYBACK_SPEED_ATTR);
    const topVisVideos = findVideosAtCenter(document?.body);
    for (const eachVideo of topVisVideos) {
      if (eachVideo.playbackRate !== DEFAULT_SPEED_NUM) {
        // we found a video NOT playing at the default rate, so that's what we use.
        return formatFloat(eachVideo.playbackRate);
      }
    }
    if (attrValue === DEFAULT_SPEED_STR) {
      // if we get here, then all the found video are playing 1.0, if the PLAYBACK_SPEED_ATTR is 1.0, then
      // we really don't know for sure what it should be, so just return an empty string.
      document.body.removeAttribute(PLAYBACK_SPEED_ATTR);
      return "";
    }

    return attrValue ?? "";
  } catch (err) {
    logerr("injectGetPlaypackSpeed error: ", err);
    return "";
  }
}

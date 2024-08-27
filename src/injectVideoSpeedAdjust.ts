/*
 Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 Tricky situations:
 - Videos are auto-playing in a list and the speed is set in videomax
 - Video speed is changed externally and when a video is loading, videomax tries to reset it.x
 */

import {
  DEV_MODE,
  logtrace,
  findVideosAtCenter,
  isElemVisable,
  logerr,
  PLAYBACK_SPEED_DOC_ATTR,
  safeParseFloat,
  DEFAULT_SPEED_STR,
} from "./common.js"; // .js embeds the contents

/**
 * @param newspeed If empty, then try and load the speed saved at the doc level and reapply it. If both empty, then
 *                  do nothing.
 * @param allowPlaybackToggle
 */
export function injectVideoSpeedAdjust(newspeed: string, allowPlaybackToggle = true) {
  function _getSavedSpeedFromDocument(newspeed?: string) {
    if (newspeed && newspeed?.length > 0) {
      return safeParseFloat(newspeed, 1.0);
    }
    const savedSpeedStr = document.body.getAttribute(PLAYBACK_SPEED_DOC_ATTR) ?? DEFAULT_SPEED_STR;
    if (savedSpeedStr?.length > 0) {
      return safeParseFloat(newspeed, 1.0);
    }
    return 1.0;
  }

  /**
   * This is called when more data is loaded by the video.
   * When the video comes out of "spinner while loading more data" sometimes
   * the speed gets reset
   */
  function _loadStart(event: Event) {
    try {
      // check to see if we're still injected into page.
      const runningAttr = document?.body?.getAttribute("data-videomax-running") ?? "";
      if (runningAttr.length <= 0) {
        if (DEV_MODE) {
          // eslint-disable-next-line no-console
          console.log(`VideoMaxExt: loadStart injectVideoSpeedAdjust No longer injected, bailing`);
        }
        return;
      }
      const videoElem = event?.target as HTMLMediaElement;

      if (!!videoElem?.src?.length || videoElem.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (DEV_MODE) {
          // eslint-disable-next-line no-console
          console.log(`VideoMaxExt: loadStart injectVideoSpeedAdjust not running since video not in correct state. 
          src:"${videoElem?.src}"
          readyState:${videoElem.readyState}`);
        }
        return;
      }

      const isVis = isElemVisable(videoElem);
      const speedNumber = _getSavedSpeedFromDocument();
      // eslint-disable-next-line no-console
      logtrace(`VideoMaxExt: loadStart injectVideoSpeedAdjust
          isVis: ${isVis} (false means won't set speed) 
          speedNumber: ${speedNumber}
          videoElem.playbackRate: ${videoElem?.playbackRate}, videoElem`);
      if (isVis && videoElem && videoElem?.playbackRate !== speedNumber) {
        // it's changed
        videoElem.playbackRate = speedNumber;
      }

      // we've loaded, remove ourselves?

      videoElem.removeEventListener("loadstart", _loadStart);
      logtrace(`videoElem.removeEventListener when RUN!`);
    } catch (err) {
      // eslint-disable-next-line no-console
      logerr(`loadStart err`, err);
    }
  }

  /**
   *
   * newPlaybackRate Neg means paused, but the speed is the "toggle back to speed"
   */
  function _injectSetSpeedForVideo(
    videoElem: HTMLVideoElement,
    newPlaybackRate: number,
    newAllowPlaybackToggle: boolean,
  ) {
    // Always remove possible loadstart listeners since ads may be on top of older videos
    //  filter out any videos that don't have a src or data?
    if (!videoElem?.src?.length && videoElem.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    videoElem.removeEventListener("loadstart", _loadStart);

    // if the speed is negative, then we pause
    if (newAllowPlaybackToggle && newPlaybackRate <= 0) {
      videoElem.pause();
    } else if (newAllowPlaybackToggle && videoElem?.paused && !videoElem?.ended) {
      videoElem.play().then((r) => {});
    }
    // topVisVideo.defaultPlaybackRate = speed;
    videoElem.playbackRate = Math.abs(newPlaybackRate);
    videoElem.addEventListener("loadstart", _loadStart);
  }

  const speedNumber = _getSavedSpeedFromDocument(newspeed);
  try {
    if (document?.body && newspeed !== DEFAULT_SPEED_STR) {
      document.body.setAttribute(PLAYBACK_SPEED_DOC_ATTR, newspeed);
    } else {
      // default then we should remove it.
      document.body.removeAttribute(PLAYBACK_SPEED_DOC_ATTR);
    }
  } catch (err) {
    // could be cross frame error?
  }

  const topVisVideos = findVideosAtCenter(document?.body);
  if (topVisVideos.length === 0) {
    // this happens a lot when injected into a iframe that's not a video one
    return;
  }

  for (const eachVideo of topVisVideos) {
    _injectSetSpeedForVideo(eachVideo, speedNumber, allowPlaybackToggle);
    break; // for MBA, if we do ALL the videos then skipping ads will skip main video
  }
}

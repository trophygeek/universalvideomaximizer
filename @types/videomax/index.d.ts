// @ts-check
/**
 * Put types in a .d.ts and they are used automatically
 * by the IDE to help with typechecking w/out needing
 * too transpile with javascript. Neat.
 */

type KeyValuePair = {
  [key: string]: string
};

type SettingsType = {
  lastBetaVersion?: string,
  useAdvancedFeatures: boolean,
  spacebarTogglesPlayback: boolean,
  regSkipSeconds: number,
  longSkipSeconds: number,
  proportionalSkipTimes: boolean,
  wholeDomainAccess: boolean,
  allSitesAccess: boolean,
  allSitesAccessNeedsRevoke: boolean,
  zoomExclusionListStr: string,
  beta3EndingShown?: boolean,
  firstUseShown?: boolean,
  firstUseOn2ndScreen?: boolean,
  noStickySPANav?: boolean, // zooming should auto-reapply on the same domain (e.g. back button)
};

type SettingsKeyType = keyof SettingsType;

type SettingStorageKeyConstType = "settingsJson";

// Used by chrome.runtime.sendMessage
type CmdType =
    "UNZOOM_CMD"
    | "SET_SPEED_CMD"
    | "REZOOM_CMD"
    | "SKIP_PLAYBACK_CMD"
    | "OPTIONS_CMD"
    | "GET_SPEED_PREP_CMD"
    | "GET_SPEED_COMPLETE_CMD"
    | "PAGE_UNZOOMED_NOTIFICATION"
    | "PAGE_LOST_VIDEO_NOTIFICATION"
    | ""; // last one is fallback

type BackgroundMessage = {
  message: {
    cmd: CmdType,
    tabId: number,
    domain?: string,
    speed?: string,
  }
}

type BackgroundMessageResponse = {
  success: boolean,
  playbackSpeed?: string,
}

type CheckVideoZoomedState = "UNZOOMED" | "ZOOMED" | "NEEDS_REZOOM";


// Used by popup for buttons that aren't speed changes.
type PopupMenuCmd = "UNZOOM_BTN_CMD" | "OPTIONS_BTN_CMD";

type Rect = {
  top: number,
  left: number,
  bottom: number,
  right: number,
  width: number,
  height: number
}

type ActionFunction = (elem: Node) => boolean;

type HtmlElementType = keyof Partial<HTMLElementTagNameMap>;
type HtmlElementTypes = HtmlElementType[];

type VideoElemTypes = HTMLVideoElement | HTMLIFrameElement | Element | null;

type VideomaxGlobalsTypeBase = {
  matchedVideo: VideoElemTypes;
  matchVideoRect: Rect;
  matchedVideoSrc: string;
  matchedCommonCntl: Element | null;
  processInFrame: boolean,
  isMaximized: boolean,
  tagonly: boolean,
  unzooming: boolean,
  ads: Set<VideoElemTypes>
};

type ErrorMsg = 'CLEAR_ERROR_MSG' | 'REZOOM_FOR_EXTRA_PERMISSIONS_ERROR_MSG' | 'SKIP_FAILS_ON_NETFLIX';

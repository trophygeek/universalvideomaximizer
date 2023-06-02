// @ts-check
/**
 * Put types in a .d.ts and they are used automatically
 * by the IDE to help with typechecking w/out needing
 * too transpile with javascript. Neat.
 */

type SettingsType = {
  lastBetaVersion: string,
  useToggleZoomBehavior: boolean,
  spacebarTogglesPlayback: boolean,
  regSkipSeconds: number,
  longSkipSeconds: number,
  preportionalSkipTimes: boolean,
  allSitesAccess: boolean,
  allSitesAccessNeedsRevoke: boolean,
  zoomExclusionListStr: string,
};

type SettingsKeyType = keyof SettingsType;

type SettingStorageKeyConstType = "settingsJson";

// Used by chrome.runtime.sendMessage
type CmdType = "UNZOOM_CMD" | "SET_SPEED_CMD" | "REZOOM_CMD" | "SKIP_PLAYBACK_CMD" | "TOGGLE_PLAYBACK_CMD";

// Used by popup for buttons that aren't speed changes.
type PopupMenuCmd = "UNZOOM_BTN_CMD" | "OPTIONS_BTN_CMD";

type DebounceInternalData = {
  timeoutId: number,
  isRunning: boolean,
  nextArgs: [any],
};

type DebounceMap = { [key: string]: DebounceInternalData };

type Rect = {
  top: number,
  left: number,
  bottom: number,
  width: number,
  right: number,
  height: number
}

type BackgroundState =
    "RESET"
    | "ZOOMING" // maps to ZOOMED_NOSPEED or ZOOMED_SPEED
    | "ZOOMING_SPEED_ONLY" // maps to SPEED_ONLY
    | "ZOOMED_NOSPEED"
    | "ZOOMED_SPEED"
    | "SPEED_ONLY"
    | "REFRESH"
    | "ERR_PERMISSION"
    | "ERR_URL";

type BackgroundStateMap = {
  [key in BackgroundState]: {
    readonly badge: string,
    readonly title: string,
    readonly showpopup: boolean,
    readonly zoomed: boolean,
    readonly color: string,
  }
}


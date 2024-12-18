/*
 Video Maximizer

 Copyright (c) 2023-2024. trophygeek@gmail.com
 www.videomaximizer.com

 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 */

import { PERMISSIONS_CHECK_DOMAINS_DOC_ATTR } from "./common";

export function injectCheckPermissions(): string[] {
  const resultCrossDomainSet: Set<string> = new Set<string>(); // use Set to dedup
  const domainliststr = document.body.getAttribute(PERMISSIONS_CHECK_DOMAINS_DOC_ATTR) ?? "";
  const domainlist = domainliststr.split(",");
  for (const eachDomain of domainlist) {
    resultCrossDomainSet.add(eachDomain.trim());
  }
  return [...resultCrossDomainSet]; // Set->array
}

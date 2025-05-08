import browser from "webextension-polyfill";

const elManageTab = document.getElementById("menu-tab-manage-bookmarks");
const elDetectDuplicatesTab = document.getElementById("menu-tab-detect-duplicates");
const elFindBrokenTab = document.getElementById("menu-tab-detect-dead-bookmarks");

/**
 * @typedef {"manage" | "duplicate" | "broken" | "none"} BookmarkBurstTabs
 */

/**
 * BROWSER EVENTS
 */

browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  const selectedTab = getSelectedTab();

  // Only rerun duplicates search if the "Duplicates" tab is active.
  if (selectedTab === "duplicate") {
    document.getElementById("start-find-duplicates")?.click();
  }
});

/**
 * FUNCTIONS
 */

/**
 * @returns {BookmarkBurstTabs}
 */
function getSelectedTab() {
  if (elManageTab.classList.contains("active")) {
    return "manage";
  }
  if (elDetectDuplicatesTab.classList.contains("active")) {
    return "duplicate";
  }
  if (elFindBrokenTab.classList.contains("active")) {
    return "broken";
  }
  return "none";
}

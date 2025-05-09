import browser from "webextension-polyfill";
import { BookmarkBurst } from "./BookmarkBurst";

const bookmarkBurst = new BookmarkBurst();

bookmarkBurst.onActionClick(() => {
  const url = browser.runtime.getURL("index.html");
  browser.tabs.create({ url });
});

bookmarkBurst.onPermissionsGranted((permissions) => {
  console.info(`Permissions granted!`, { permissions });
});

bookmarkBurst.onPermissionsRemoved((permissions) => {
  console.warn(`Permissions removed!`, { permissions });
});

bookmarkBurst.onMessage("detect-dead-bookmarks", async (msg, sender, response) => {
  const { bookmarks, timeout } = msg;
  for (const bmark of bookmarks) {
  }
  response(true);
});

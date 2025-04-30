# BookmarkBurst

Browser extension for various bookmark related tasks with support for Chrome and Firefox.

# Features

- [Open Multiple Bookmarks at Once](#open-multiple-bookmarks-at-once)
- [Find Duplicate Bookmarks By Title or URL](#find-duplicate-bookmarks-by-title-or-url)

#### Open Multiple Bookmarks at Once

Select any amount of specific bookmarks as you wish and open them all in one click! You now have fine-grained control over the selection of bookmarks to open at once, even bookmarks in different folders!

#### Find Duplicate Bookmarks By Title or URL

Search your bookmarks for duplicate Title's and duplicate URL's!

# Permissions

**Please note: when using the `Find Dead Bookmarks` feature, you will be prompted for additional permissions.** See the table below for why that is.

| Permission                        | Required? | Explanation                                                                                                                                    | More Info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bookmarks                         | Yes       | So we can read, create, and/or modify bookmarks                                                                                                | More information on these permissions can be found [here for Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks) and [here for Chrome](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)                                                                                                                                                                                                                                                                                                           |
| Tabs                              | Yes       | So we can open bookmarks in new tabs                                                                                                           | More info on these permissions can be found [here for Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs) and [here for Chrome](https://developer.chrome.com/docs/extensions/reference/api/tabs)                                                                                                                                                                                                                                                                                                                            |
| Access your data for all websites | No        | These permissions are used for finding dead bookmarks. Specifically, to send requests to each of your bookmarks to test the websites response. | You will be prompted for these permissions upon browsing to the `Find Dead Bookmarks` feature. If you do not want to use the `Find Dead Bookmarks` feature, you can deny these permissions when prompted. More information [Firefox can be found here](https://support.mozilla.org/en-US/kb/permission-request-messages-firefox-extensions?as=u&utm_source=inproduct#w_access-your-data-for-all-websites) and more information for [Chrome can be found here](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions#host-permissions) |

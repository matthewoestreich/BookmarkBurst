# BookmarkBurst

Browser extension for various bookmark related tasks with support for Chrome and Firefox.

## Features

- [Dark and Light Modes](#themes)
- [Open Multiple Bookmarks at Once](#open-multiple-bookmarks-at-once)
- [Find Duplicate Bookmarks By Title or URL](#find-duplicate-bookmarks-by-title-or-url)

#### Themes

Whether it is dark mode or light mode, choose your favorite theme for the best browsing experience!

#### Open Multiple Bookmarks at Once

Select any amount of specific bookmarks as you wish and open them all in one click! You now have fine-grained control over the selection of bookmarks to open at once, even bookmarks in different folders!

#### Find Duplicate Bookmarks By Title or URL

Search your bookmarks for duplicate Titles and URLs!

## Permissions

<table>
  <thead>
    <tr>
      <th>Permission</th>
      <th>Required?</th>
      <th>Explanation</th>
      <th>More Info</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Bookmarks</td>
      <td>Yes</td>
      <td>So we can read, create, and/or modify bookmarks.</td>
      <td><a href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks">Firefox</a> & <a href="https://developer.chrome.com/docs/extensions/reference/api/bookmarks">Chrome</a></td>
    </tr>
    <tr>
      <td>Tabs</td>
      <td>Yes</td>
      <td>So we can open bookmarks in new tabs.</td>
      <td><a href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs">Firefox</a> & <a href="https://developer.chrome.com/docs/extensions/reference/api/tabs">Chrome</a></td>
    </tr>
    <tr>
      <td>Access your data for all websites</td>
      <td>No</td>
      <td>These permissions are used for finding dead bookmarks. Specifically, to send requests to each of your bookmarks to test the websites response.</td>
      <td>
      <a href="https://support.mozilla.org/en-US/kb/permission-request-messages-firefox-extensions?as=u&utm_source=inproduct#w_access-your-data-for-all-websites">Firefox</a> & <a href="https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions#host-permissions">Chrome</a>.
      <br/>You will be prompted for these permissions upon browsing to the <code>Find Dead Bookmarks</code> feature. <br/>If you do not wish to use the <code>Find Dead Bookmarks</code> feature, you can deny these permissions when prompted.
      </td>
    </tr>
  </tbody>
</table>

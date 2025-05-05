/**
 * For lazy-loading new tabs. To save on resources, new tabs are not fully loaded
 * until the user clicks the tab.
 * We stick the actual URL on the end of our "lazy-load.html" URL as an href/hash.
 * Once the new tab is clicked we replace the URL with the first href/hash.
 */
const realURL = window.location.hash.substring(1);
document.title = realURL;

window.addEventListener(
  "focus",
  () => {
    window.location.replace(realURL);
  },
  false,
);

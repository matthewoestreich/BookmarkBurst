import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

import { createLoadingSpinner } from "./loadingSpinner";
import { createEditBookmarkModal } from "./editBookmarkModal";
import { createConfirmationModal } from "./confirmationModal";

/**
 * Documenting custom data attributes for Folder and Bookmark HTML elements.
 *
 *  "data-bmb-id":
 *    The BookmarkTreeNode id.
 *
 *  "data-bmb-title":
 *    The BookmarkTreeNode title.
 *
 *  "data-bmb-date-added":
 *    The date the BookmarkTreeNode was added as a bookmark.
 *
 *  "data-bmb-type":
 *    Can either be "folder" or "bookmark".
 *
 *  "data-bmb-url":
 *    The URL of the BookmarkTreeNode,
 *
 *  "data-bmb-folder-icon-expanded":
 *    Used for the icon on bookmark folders. Value can be 0 or 1, 0=collapsed, 1=expanded.
 *    Mostly for CSS selector.
 *
 *  "data-bmb-checkbox":
 *    Used for bookmark checkboxes. Mostly for a query selector so we can mass uncheck every single bookmark.
 *    At the time of writing this, it doesn't need a value, we just query for the attributes existence.
 */

/**
 * Other misc notes:
 *
 *  - A parent folder (li) children will be mounted on a child node with the id of `#children-${parentLI.getAttribute("data-bmb-id")}`
 *    So if you wanted to target the children for a node that has the id of "abc123", you could do:
 *      `const parent = document.querySelector("#node-abc123");`
 *      `const childMountEl = parent.querySelector(`#children-${parent.dataset.bmbId}`);`
 */

/**
 * @typedef {"Folders First" | "Date Added Newest First" | "Date Added Newest Last" | "Alphabetical"} SortNodesBy
 * @typedef {"title" | "url"} SearchNodesBy
 */

const elRootBookmarksList = document.getElementById("bookmarks-list");
const elSortBookmarksSelect = document.getElementById("sort-bookmarks");
const elOpenSelectedBookmarksButton = document.getElementById("open-selected-bookmarks");
const elClearAllSelectedButton = document.getElementById("clear-all-selected");
const elSearchBookmarksText = document.getElementById("open-many-tab-search-text");
const elSearchBookmarksButton = document.getElementById("open-many-tab-start-search");

// Making an exception and putting this function here instead of in the FUNCTIONS section
async function initializeTree() {
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  renderRawNodes(root.children, elRootBookmarksList);
}

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  elRootBookmarksList.appendChild(createLoadingSpinner());
  await initializeTree();
});

// The "select" element for sorting bookmarks
elSortBookmarksSelect.addEventListener("change", () => {
  sortHTMLNodes(elRootBookmarksList, elSortBookmarksSelect.value);
});

// The button for opening all selected bookmarks
elOpenSelectedBookmarksButton.addEventListener("click", async () => {
  try {
    const currentTab = await browser.tabs.getCurrent();
    let tabIndex = currentTab.index + 1;

    for (const checked of window.CHECKED_NODES) {
      if (checked.url) {
        const lazyUrl = browser.runtime.getURL("lazy-load.html#") + checked.url;
        browser.tabs.create({ url: lazyUrl, index: tabIndex, active: false });
        tabIndex++;
      }
    }
  } catch (e) {
    console.error(`[BookmarkBurst][open-selected-bookmarks]`, e);
  }
});

// The button for clearing all selected bookmarks/folders
elClearAllSelectedButton.addEventListener("click", () => {
  const allCheckboxes = document.querySelectorAll("input[data-bmb-checkbox]");
  for (const checkbox of allCheckboxes) {
    checkbox.checked = false;
  }
  window.CHECKED_NODES.clear();
});

// Search bookmarks
elSearchBookmarksButton.addEventListener("click", async () => {
  // Uncheck everything
  elClearAllSelectedButton.click();
  const searchText = document.getElementById("open-many-tab-search-text")?.value;
  if (!searchText || searchText === "") {
    return await initializeTree();
  }
  const searchBy = document.getElementById("open-many-tab-search-by")?.value;
  if (!searchBy || searchBy === "" || (searchBy !== "url" && searchBy !== "title")) {
    return null;
  }
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  const results = searchBookmarks(searchText, searchBy, root.children);
  renderRawNodes(results, elRootBookmarksList);
});

// If someone presses Enter in the search bar, start the search.
elSearchBookmarksText.addEventListener("keyup", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.stopPropagation();
  elSearchBookmarksButton.click();
});

/**
 * ==============================================================================================================================
 * FUNCTIONS
 * ==============================================================================================================================
 */

/**
 * Allows us to wait for layout + next paint to occur.
 * @returns {Promise<void>}
 */
async function waitForNextFrame() {
  return new Promise((resolve) => {
    // We have 2 `requestAnimationFrame` calls so we can wait for layout and paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

/**
 * Responsible for adding the BookmarkTreeNode to our global 'checked nodes' set.
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @param {Set<browser.Bookmarks.BookmarkTreeNode>} checkedNodesSet
 */
function toggleCheckedBookmarkTreeNode(node, checkedNodesSet) {
  if (checkedNodesSet.has(node)) {
    checkedNodesSet.delete(node);
    return;
  }
  checkedNodesSet.add(node);
}

/**
 * Handles collapsing or expanding a node. Determines whether or not a folder is expanded
 * based upon the `data-bmb-expanded` attribute. A value of "0" means collapsed, a value
 * of "1" means expanded.
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @param {HTMLUListElement} childUList
 * @param {SortNodesBy} sortBy
 */
function handleNodeCollapseOrExpand(node = null, childUList = null) {
  try {
    // So we can set the expanded or not value on the icon, so that CSS can rotate it (or not).
    const spanAction = childUList.closest("li")?.querySelector("span[data-bmb-folder-icon-expanded]");
    const isExpanded = Boolean(parseInt(childUList.getAttribute("data-bmb-expanded")));

    if (isExpanded) {
      // Need to collapse
      childUList.classList.remove("show");
      childUList.setAttribute("data-bmb-expanded", 0);
      childUList.replaceChildren();
      if (spanAction) {
        spanAction.setAttribute("data-bmb-folder-icon-expanded", 0);
      }
    } else {
      // Need to expand
      childUList.appendChild(createLoadingSpinner());
      childUList.classList.add("show");
      childUList.setAttribute("data-bmb-expanded", 1);
      if (spanAction) {
        spanAction.setAttribute("data-bmb-folder-icon-expanded", 1);
      }
      // Wait for loading spinner to show first.
      waitForNextFrame().then(() => renderRawNodes(node.children, childUList));
    }
  } catch (e) {
    console.error("[handleNodeCollapseOrExpand][Error]", { error: e, node });
  }
}

/**
 * Renders raw `BookmarkTreeNode`s
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {HTMLElement} appendToElement
 */
function renderRawNodes(nodes, appendToElement) {
  appendToElement.replaceChildren();
  sortRawNodes(nodes, elSortBookmarksSelect.value);

  for (const node of nodes) {
    // Only Firefox has a "separator" type.
    if (node.type === "separator") {
      continue;
    }
    if (node.url) {
      const bookmarkHTML = generateBookmarkHTML(node);
      appendToElement.appendChild(bookmarkHTML);
    } else if (!node.url) {
      const folderHTML = generateFolderHTML(node);
      appendToElement.appendChild(folderHTML);
    }
  }
}

/**
 * ==============================================================================================================================
 * FUNCTIONS : HTML Generation
 * ==============================================================================================================================
 */

/**
 * Generates HTML for bookmark type of BookmarkNode.
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @returns {HTMLLIElement}
 */
function generateBookmarkHTML(node) {
  if (!node.url) {
    console.warn(`[BookmarkBurst] cannot generate bookmark HTML using folder node!`);
    return null;
  }

  const checkboxId = `checkbox-${node.id}`;

  const mainBookmarkLItem = document.createElement("li");
  const divBookmarkRootContainer = document.createElement("div");
  const divFormCheck = document.createElement("div");
  const inputCheckbox = document.createElement("input");
  const labelForCheckbox = document.createElement("label");
  const aLink = document.createElement("a");
  const spanToggleExpand = document.createElement("span");
  const actionsPanelRootDiv = document.createElement("div");
  const actionButtonEdit = document.createElement("button");
  const actionButtonEditIcon = document.createElement("i");
  const actionButtonDelete = document.createElement("delete");
  const actionButtonDeleteIcon = document.createElement("i");

  actionsPanelRootDiv.classList.add("d-none", "ms-auto", "me-3", "d-flex", "flex-row", "gap-2");

  actionButtonEditIcon.classList.add("bi", "bi-pencil");
  actionButtonEdit.classList.add("btn", "btn-sm", "btn-primary", "p-0");
  actionButtonEdit.style.height = "25px";
  actionButtonEdit.style.width = "25px";
  actionButtonEdit.addEventListener("click", () => {
    const editBookmarkModal = createEditBookmarkModal({
      url: node.url,
      title: node.title,
      onCancelButtonClick: () => {
        editBookmarkModal.hide();
      },
      onSaveButtonClick: async ({ setAlert, originalTitle, originalUrl, updatedUrl, updatedTitle }) => {
        try {
          // If any changes were made we need to update the bookmark, as well as our results that are being displayed.
          if (originalUrl !== updatedUrl || originalTitle !== updatedTitle) {
            const updatedNode = await browser.bookmarks.update(node.id, { url: updatedUrl, title: updatedTitle });
            setAlert({ alertMessage: "Successfully edited bookmark!", alertType: "success" });
            mainBookmarkLItem.replaceWith(generateBookmarkHTML(updatedNode));
          }
        } catch (e) {
          setAlert({ alertMessage: "Error! Something went wrong!", alertType: "danger" });
          console.error(`[BookmarkBlast][edit-bookmark-modal-save] Error saving bookmark!`, e);
        }
      },
    });

    if (editBookmarkModal) {
      editBookmarkModal.show();
    } else {
      console.error(`[BookmarkBurst][manage][ERROR] Something went wrong while trying to display edit-bookmark-modal!`);
    }
  });

  actionButtonDeleteIcon.classList.add("bi", "bi-trash");
  actionButtonDelete.classList.add("btn", "btn-sm", "btn-danger", "p-0");
  actionButtonDelete.style.height = "25px";
  actionButtonDelete.style.width = "25px";
  actionButtonDelete.addEventListener("click", () => {
    const confirmationModal = createConfirmationModal({
      title: "Confirmation",
      okButtonText: "Yes",
      closeButtonText: "No",
      message: "Are you sure you want to delete this bookmark?\n\nThis action cannot be undone!",
      onCancelButtonClick: (e) => {
        confirmationModal.hide();
      },
      onOkButtonClick: async (e) => {
        try {
          await browser.bookmarks.remove(node.id);
        } catch (e) {
          console.log("[BookmarkBurst][manage][ERROR] Something went wrong while attempting to delete a bookmark!", { error: e, node });
        } finally {
          mainBookmarkLItem.remove();
          confirmationModal.hide();
        }
      },
    });

    if (confirmationModal) {
      confirmationModal.show();
    } else {
      console.error(`[BookmarkBurst][manage][ERROR] Something went wrong while trying to display confirmation-modal to delete bookmark!`);
    }
  });

  actionButtonEdit.appendChild(actionButtonEditIcon);
  actionButtonDelete.appendChild(actionButtonDeleteIcon);
  actionsPanelRootDiv.appendChild(actionButtonDelete);
  actionsPanelRootDiv.appendChild(actionButtonEdit);

  mainBookmarkLItem.classList.add("list-group-item", "word-break-all", "p-1", "ps-3");
  mainBookmarkLItem.id = node.id;

  const mainBookmarkLItemAttributes = {
    "data-bmb-id": node.id,
    "data-bmb-title": node.title,
    "data-bmb-date-added": node.dateAdded,
    "data-bmb-type": "bookmark",
    "data-bmb-url": node.url,
  };

  Object.entries(mainBookmarkLItemAttributes).forEach(([key, val]) => {
    mainBookmarkLItem.setAttribute(key, val);
  });

  divBookmarkRootContainer.classList.add("d-flex", "align-items-center");
  divBookmarkRootContainer.style.cursor = "pointer";

  divFormCheck.classList.add("form-check");

  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.style.cursor = "pointer";
  inputCheckbox.id = checkboxId;
  inputCheckbox.setAttribute("data-bmb-checkbox", "true");

  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.style.cursor = "pointer";
  labelForCheckbox.htmlFor = checkboxId;

  //aLink.classList.add("overflow-hidden", "text-nowrap", "text-truncate", "d-inline-block", "w-100");
  aLink.href = node.url;
  aLink.target = "_blank";
  aLink.innerText = node.title;

  spanToggleExpand.classList.add("me-3");
  spanToggleExpand.textContent = String.fromCharCode(160);

  /** Event Handlers */

  divBookmarkRootContainer.addEventListener("click", function (event) {
    event.stopPropagation();
    if (event.target !== this) {
      return;
    }
    inputCheckbox.checked = !inputCheckbox.checked;
    toggleCheckedBookmarkTreeNode(node, window.CHECKED_NODES);
  });

  divBookmarkRootContainer.addEventListener("mouseover", function (event) {
    this.classList.add("bg-body-tertiary");
    actionsPanelRootDiv.classList.remove("d-none");
  });

  divBookmarkRootContainer.addEventListener("mouseleave", function (event) {
    this.classList.remove("bg-body-tertiary");
    actionsPanelRootDiv.classList.add("d-none");
  });

  inputCheckbox.addEventListener("change", (event) => {
    event.stopPropagation();
    toggleCheckedBookmarkTreeNode(node, window.CHECKED_NODES);
  });

  aLink.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  divBookmarkRootContainer.appendChild(spanToggleExpand);
  divBookmarkRootContainer.appendChild(divFormCheck);
  divBookmarkRootContainer.appendChild(actionsPanelRootDiv);
  labelForCheckbox.appendChild(aLink);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  mainBookmarkLItem.appendChild(divBookmarkRootContainer);

  return mainBookmarkLItem;
}

/**
 * Generates HTML for folder type of BookmarkNode
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @returns {HTMLLIElement}
 */
function generateFolderHTML(node) {
  if (node.url) {
    console.warn(`[BookmarkBurst] cannot generate folder HTML using bookmark node!`);
    return null;
  }

  const childrenId = `children-${node.id}`;

  const mainFolderLItem = document.createElement("li");
  const divRootContainer = document.createElement("div");
  const divFormCheck = document.createElement("div");
  const inputCheckbox = document.createElement("input");
  const labelForCheckbox = document.createElement("label");
  const badgeNumberOfChildren = document.createElement("span");
  const spanAction = document.createElement("span");
  const strong = document.createElement("strong");
  const divChildrenContainer = document.createElement("div");
  const childrenUList = document.createElement("ul");

  mainFolderLItem.classList.add("list-group-item", "p-1", "ps-3");
  mainFolderLItem.id = `node-${node.id}`;

  const mainFolderLItemAttributes = {
    "data-bmb-id": node.id,
    "data-bmb-title": node.title,
    "data-bmb-date-added": node.dateAdded,
    "data-bmb-type": "folder",
    "data-bmb-url": "",
  };

  Object.entries(mainFolderLItemAttributes).forEach(([key, val]) => {
    mainFolderLItem.setAttribute(key, val);
  });

  divRootContainer.classList.add("d-flex", "align-items-center");

  divFormCheck.classList.add("form-check");

  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.id = node.id;
  inputCheckbox.checked = node.checked;
  inputCheckbox.style.cursor = "pointer";
  inputCheckbox.setAttribute("data-bmb-checkbox", "true");

  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.htmlFor = node.id;
  labelForCheckbox.style.cursor = "pointer";

  spanAction.classList.add("me-2");
  spanAction.textContent = String.fromCharCode(9654);
  spanAction.role = "button";
  spanAction.setAttribute("data-bmb-folder-icon-expanded", 0);

  strong.innerText = (node.title || "<Unnamed Folder>") + String.fromCharCode(160).repeat(3);

  badgeNumberOfChildren.classList.add("badge", "text-bg-primary", "p-1");
  badgeNumberOfChildren.style.fontSize = "0.72rem";
  badgeNumberOfChildren.innerText = node.children.length;

  divChildrenContainer.classList.add("collapse", "ms-2", "show");

  childrenUList.classList.add("list-group", "list-group-flush");
  childrenUList.id = childrenId;
  childrenUList.setAttribute("data-bmb-expanded", 0);

  /** Event Handlers */

  divRootContainer.addEventListener("mouseover", function () {
    this.classList.add("bg-body-tertiary");
    this.style.cursor = "pointer";
  });

  divRootContainer.addEventListener("mouseleave", function () {
    this.classList.remove("bg-body-tertiary");
  });

  divRootContainer.addEventListener("click", function (event) {
    event.stopPropagation();
    if (event.target !== this) {
      return;
    }
    handleNodeCollapseOrExpand(node, childrenUList);
  });

  // Expand/collapse node + get child nodes
  spanAction.addEventListener("click", function (event) {
    event.stopPropagation();
    try {
      handleNodeCollapseOrExpand(node, childrenUList);
    } catch (e) {
      console.error(e);
    }
  });

  // When checkbox is changed.
  inputCheckbox.addEventListener("change", async (event) => {
    event.stopPropagation();
    toggleCheckedBookmarkTreeNode(node, window.CHECKED_NODES);
    // If a folder is checked, auto check it's children.
    // In order to make sure it has children to check, we need to expand it first (if it isn't already).
    if (!Boolean(parseInt(childrenUList.getAttribute("data-bmb-expanded")))) {
      handleNodeCollapseOrExpand(node, childrenUList);
    }
    for (const child of Array.from(childrenUList.childNodes)) {
      // Don't check child folders
      if (child.dataset.bmbType === "folder") {
        continue;
      }
      const childBookmarkTreeNode = await browser.bookmarks.get(child.dataset.bmbId);
      if (childBookmarkTreeNode) {
        toggleCheckedBookmarkTreeNode(childBookmarkTreeNode, window.CHECKED_NODES);
        const childCheckboxSelector = `#checkbox-${child.id}`;
        const elChildCheckbox = child.querySelector(childCheckboxSelector);
        // Set child bookmark check state to what the parent folder is.
        if (elChildCheckbox) {
          elChildCheckbox.checked = inputCheckbox.checked;
        }
      }
    }
  });

  divChildrenContainer.appendChild(childrenUList);
  labelForCheckbox.appendChild(strong);
  labelForCheckbox.appendChild(badgeNumberOfChildren);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  divRootContainer.appendChild(spanAction);
  divRootContainer.appendChild(divFormCheck);
  mainFolderLItem.appendChild(divRootContainer);
  mainFolderLItem.appendChild(divChildrenContainer);

  return mainFolderLItem;
}

/**
 * ==============================================================================================================================
 * FUNCTIONS : Sorting Related
 * ==============================================================================================================================
 */

/**
 * Parses and sorts raw BookmarkTreeNode[]
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {SortNodesBy} sortBy
 */
export function sortRawNodes(nodes, sortBy) {
  switch (sortBy) {
    case "Folders First": {
      nodes.sort((a, b) => {
        const aIsFolder = !a.url;
        const bIsFolder = !b.url;
        if (aIsFolder && !bIsFolder) {
          return -1;
        }
        if (!aIsFolder && bIsFolder) {
          return 1;
        }
        return (a.title || "").localeCompare(b.title || "");
      });
      break;
    }
    case "Date Added Newest First": {
      nodes.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      break;
    }
    case "Date Added Newest Last": {
      nodes.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
      break;
    }
    case "Alphabetical": {
      nodes.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Parses already rendered HTML nodes and sorts them.
 * @param {HTMLElement} parentElement
 * @param {SortNodesBy} sortBy
 */
export function sortHTMLNodes(parentElement, sortBy) {
  const children = Array.from(parentElement.childNodes);

  children.sort((a, b) => {
    const aIsFolder = a.dataset.bmbType === "folder";
    const bIsFolder = b.dataset.bmbType === "folder";

    if (sortBy === "Folders First") {
      if (aIsFolder && !bIsFolder) {
        return -1;
      }
      if (!aIsFolder && bIsFolder) {
        return 1;
      }
      return a.dataset.bmbTitle.localeCompare(b.dataset.bmbTitle);
    }
    if (sortBy === "Date Added Newest First") {
      return (+b.dataset.bmbDateAdded || 0) - (+a.dataset.bmbDateAdded || 0);
    }
    if (sortBy === "Date Added Newest Last") {
      return (+a.dataset.bmbDateAdded || 0) - (+b.dataset.bmbDateAdded || 0);
    }
    if (sortBy === "Alphabetical") {
      return (a.dataset.bmbTitle || "").localeCompare(b.dataset.bmbTitle || "");
    }
  });

  children.forEach((child) => {
    parentElement.appendChild(child);
    const elGrandchildren = child.querySelector(`#children-${child.dataset.bmbId}`);
    if (elGrandchildren) {
      sortHTMLNodes(elGrandchildren, sortBy);
    }
  });
}

/**
 * ==============================================================================================================================
 * FUNCTIONS : Search Related
 * ==============================================================================================================================
 */

/**
 * Normalize text for better search matching.
 * @param {string} text
 * @returns {string}
 */
function normalizeSearchString(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\/\.\-]/g, "")
    .trim();
}

/**
 * Calculates the Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // delete
          dp[i][j - 1] + 1, // insert
          dp[i - 1][j - 1] + 1, // substitute
        );
      }
    }
  }
  return dp[a.length][b.length];
}

/**
 * Takes an array of query strings and an array of target strings and
 * runs the levenshtein distance on each combo, calculating a more fine
 * grained distance.
 * @param {string[]} queryTokens
 * @param {string[]} targetTokens
 * @returns
 */
function tokenBasedSimilarity(queryTokens, targetTokens) {
  let totalSimilarity = 0;
  for (const qToken of queryTokens) {
    let maxSim = 0;
    for (const tToken of targetTokens) {
      const distance = levenshteinDistance(qToken, tToken);
      const maxLen = Math.max(qToken.length, tToken.length);
      const similarity = 1 - distance / maxLen;
      if (similarity > maxSim) {
        maxSim = similarity;
      }
    }
    totalSimilarity += maxSim;
  }
  return totalSimilarity / queryTokens.length;
}

/**
 * Calculate a simple relevance score between query and target string.
 * I would say a `targetScore` of 25 is a good place to start. The lower the `targetScore`
 * the more you can expect to match.
 * @param {string} query
 * @param {string} target
 * @param {number} targetScore : number 1 - 100
 *  (if number is less than 1, we normalize it to 1, if a number is >100 we normalize it to 100)
 * @returns {boolean}
 */
function scoreSearchMatch(query, target, targetScore) {
  if (!target) {
    return false;
  }
  if (targetScore < 1) {
    targetScore = 1;
  } else if (targetScore > 100) {
    targetScore = 100;
  }
  let score = 0;
  const normQuery = normalizeSearchString(query);
  const normTarget = normalizeSearchString(target);
  if (normTarget === normQuery) {
    // If we have an exact match I'd say that qualifies...
    return true;
  } else if (normTarget.startsWith(normQuery)) {
    score += 70;
  } else if (normTarget.includes(normQuery)) {
    score += 50;
  }
  const queryTokens = normQuery.match(/\w+/g) || [];
  const targetTokens = normTarget.match(/\w+/g) || [];
  const overlap = queryTokens.filter((t) => targetTokens.includes(t));
  score += overlap.length * 10;
  const similarity = tokenBasedSimilarity(queryTokens, targetTokens);
  score += Math.floor(similarity * 40);
  return score >= targetScore;
}

/**
 *
 * @param {string} searchString : the string used to search
 * @param {SearchNodesBy} searchBy
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @returns {browser.Bookmarks.BookmarkTreeNode[]}
 */
function searchBookmarks(searchString, searchBy, nodes) {
  if (searchBy !== "title" && searchBy !== "url") {
    return [];
  }
  const output = [];
  for (const node of nodes) {
    if (node[searchBy] && scoreSearchMatch(searchString, node[searchBy], 25)) {
      output.push(node);
    }
    if (node.children?.length) {
      const foundChildren = searchBookmarks(searchString, searchBy, node.children);
      if (foundChildren && foundChildren.length) {
        // Keep the structure of our tree
        node.children = foundChildren;
        output.push(node);
      }
    }
  }
  return output;
}

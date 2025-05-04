import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

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
 * @typedef {"Folders First" | "Date Added" | "Alphabetical"} SortNodesBy
 */

const CHECKED_NODES = new Set();

const elBookmarksList = document.getElementById("bookmarks-list");
const elSortBookmarksSelect = document.getElementById("sort-bookmarks");
const elOpenSelectedBookmarksButton = document.getElementById("open-selected-bookmarks");
const elClearAllSelectedButton = document.getElementById("clear-all-selected");

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  renderRawNodes(root.children, elBookmarksList);
});

// The "select" element for sorting bookmarks
elSortBookmarksSelect.addEventListener("change", () => {
  sortHTMLNodes(elBookmarksList, elSortBookmarksSelect.value);
});

// The button for opening all selected bookmarks
elOpenSelectedBookmarksButton.addEventListener("click", () => {
  alert("not impl");
});

// The button for clearing all selected bookmarks/folders
elClearAllSelectedButton.addEventListener("click", () => {
  const allCheckboxes = document.querySelectorAll("input[data-bmb-checkbox]");
  console.log(`found ${allCheckboxes.length} checkboxes`);
  for (const checkbox of allCheckboxes) {
    checkbox.checked = false;
  }
  CHECKED_NODES.clear();
});

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
      renderRawNodes(node.children, childUList);
      childUList.classList.add("show");
      childUList.setAttribute("data-bmb-expanded", 1);
      if (spanAction) {
        spanAction.setAttribute("data-bmb-folder-icon-expanded", 1);
      }
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
 * Generates HTML for bookmark type of BookmarkNode.
 * @param {BookmarkNode} node
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
  const spanAction = document.createElement("span");

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

  spanAction.classList.add("me-3");
  spanAction.textContent = String.fromCharCode(160);

  /** Event Handlers */

  divBookmarkRootContainer.addEventListener("click", function (event) {
    event.stopPropagation();
    if (event.target !== this) {
      return;
    }
    inputCheckbox.checked = !inputCheckbox.checked;
    toggleCheckedBookmarkTreeNode(node, CHECKED_NODES);
  });

  divBookmarkRootContainer.addEventListener("mouseover", function (event) {
    this.classList.add("bg-body-tertiary");
  });

  divBookmarkRootContainer.addEventListener("mouseleave", function (event) {
    this.classList.remove("bg-body-tertiary");
  });

  inputCheckbox.addEventListener("change", (event) => {
    console.log("change event on checkbox");
    event.stopPropagation();
    toggleCheckedBookmarkTreeNode(node, CHECKED_NODES);
  });

  aLink.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  divBookmarkRootContainer.appendChild(spanAction);
  divBookmarkRootContainer.appendChild(divFormCheck);
  labelForCheckbox.appendChild(aLink);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  mainBookmarkLItem.appendChild(divBookmarkRootContainer);

  return mainBookmarkLItem;
}

/**
 * Generates HTML for folder type of BookmarkNode
 * @param {any} node
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
  const spanAction = document.createElement("span");
  const strong = document.createElement("strong");
  const divChildrenContainer = document.createElement("div");
  const childrenUList = document.createElement("ul");

  mainFolderLItem.classList.add("list-group-item", "p-1", "ps-3");
  mainFolderLItem.id = `node-${node.id}`;

  const liAttributes = {
    "data-bmb-id": node.id,
    "data-bmb-title": node.title,
    "data-bmb-date-added": node.dateAdded,
    "data-bmb-type": "folder",
    "data-bmb-url": "",
  };

  Object.entries(liAttributes).forEach(([key, val]) => mainFolderLItem.setAttribute(key, val));

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

  strong.innerText = node.title || "<Unnamed Folder>";

  divChildrenContainer.classList.add("collapse", "ms-2", "show");

  childrenUList.classList.add("list-group", "list-group-flush");
  childrenUList.id = childrenId;
  childrenUList.setAttribute("data-bmb-expanded", 0);

  /** Event Handlers */

  divRootContainer.addEventListener("mouseover", function (event) {
    this.classList.add("bg-body-tertiary");
    this.style.cursor = "pointer";
  });

  divRootContainer.addEventListener("mouseleave", function (event) {
    this.classList.remove("bg-body-tertiary");
  });

  divRootContainer.addEventListener("click", function (event) {
    event.stopPropagation();
    console.log(event.target);
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
    toggleCheckedBookmarkTreeNode(node, CHECKED_NODES);
    const children = Array.from(childrenUList.childNodes);
    if (!children || !children.length) {
      return;
    }
    // If a folder is checked, auto check it's children. But we first need to make sure it
    // is expanded.
    // TODO : EXPAND FOLDER IF NOT EXPANDED
    for (const child of children) {
      // Don't check child folders
      if (child.dataset.bmbType === "folder") {
        continue;
      }
      const childBookmarkTreeNode = await browser.bookmarks.get(child.dataset.bmbId);
      if (childBookmarkTreeNode) {
        toggleCheckedBookmarkTreeNode(childBookmarkTreeNode, CHECKED_NODES);
        const childCheckboxSelector = `#checkbox-${child.id}`;
        const elChildCheckbox = child.querySelector(childCheckboxSelector);
        // Set child bookmark check state to what the parent folder is.
        elChildCheckbox?.checked = inputCheckbox.checked;
      }
    }
  });

  divChildrenContainer.appendChild(childrenUList);
  labelForCheckbox.appendChild(strong);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  divRootContainer.appendChild(spanAction);
  divRootContainer.appendChild(divFormCheck);
  mainFolderLItem.appendChild(divRootContainer);
  mainFolderLItem.appendChild(divChildrenContainer);

  return mainFolderLItem;
}

/**
 * Generates skeleton
 * @returns
 */
function generateSkeletonHTML() {
  const div = document.createElement("div");
  const spanTop = document.createElement("span");
  const spanMid = document.createElement("span");
  const spanBot = document.createElement("span");
  spanTop.classList.add("placeholder", "w-50");
  spanMid.classList.add("placeholder", "w-75");
  spanBot.classList.add("placeholder", "w-25");
  div.appendChild(spanTop);
  div.appendChild(spanMid);
  div.appendChild(document.createElement("br"));
  div.appendChild(spanBot);
  return div;
}

/**
 * Parses and sorts raw BookmarkTreeNode[]
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {SortNodesBy} sortBy
 */
function sortRawNodes(nodes, sortBy) {
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
    case "Date Added": {
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
function sortHTMLNodes(parentElement, sortBy) {
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
    if (sortBy === "Date Added") {
      return (+a.dataset.bmbDateAdded || 0) - (+b.dataset.bmbDateAdded || 0);
    }
    if (sortBy === "Alphabetical") {
      return (a.dataset.bmbTitle || "").localeCompare(b.dataset.bmbTitle || "");
    }
  });

  children.forEach((child) => {
    parentElement.appendChild(child);
    const elGrandchildren = child.querySelector(`#${child.dataset.bmbChildrenId}`);
    if (elGrandchildren) {
      sortHTMLNodes(elGrandchildren, sortBy);
    }
  });
}

import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

/**
 * @typedef {"Folders First" | "Date Added" | "Alphabetical"} SortNodesBy
 */

const CHECKED_NODES = new Set();
window.CHECKED_NODES = CHECKED_NODES;

const elBookmarksList = document.getElementById("bookmarks-list");
const elSortBookmarksSelect = document.getElementById("sort-bookmarks");

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  renderRawNodes(root.children, elBookmarksList);
});

elSortBookmarksSelect.addEventListener("change", () => {
  sortHTMLNodes(elBookmarksList, elSortBookmarksSelect.value);
});

/**
 *
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @param {Set<browser.Bookmarks.BookmarkTreeNode>} checkedNodesSet
 */
function toggleCheckedNode(node, checkedNodesSet) {
  if (checkedNodesSet.has(node)) {
    checkedNodesSet.delete(node);
    return;
  }
  checkedNodesSet.add(node);
}

/**
 * Handles collapsing or expanding a node.
 * @param {browser.Bookmarks.BookmarkTreeNode} node
 * @param {HTMLUListElement} childUList
 * @param {SortNodesBy} sortBy
 */
async function handleNodeCollapseOrExpand(node = null, childUList = null) {
  try {
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

  const li = document.createElement("li");
  const divFolder = document.createElement("div");
  const divFormCheck = document.createElement("div");
  const inputCheckbox = document.createElement("input");
  const labelForCheckbox = document.createElement("label");
  const aLink = document.createElement("a");
  const spanAction = document.createElement("span");

  li.classList.add("list-group-item", "word-break-all");
  li.id = `node-${node.id}`;

  const liAttributes = {
    "data-bmb-id": node.id,
    "data-bmb-title": node.title,
    "data-bmb-date-added": node.dateAdded,
    "data-bmb-type": "bookmark",
    "data-bmb-url": node.url,
  };

  Object.entries(liAttributes).forEach(([key, val]) => li.setAttribute(key, val));

  divFolder.classList.add("d-flex", "align-items-center");

  divFormCheck.classList.add("form-check");

  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.id = node.id;

  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.htmlFor = node.id;

  //aLink.classList.add("overflow-hidden", "text-nowrap", "text-truncate", "d-inline-block", "w-100");
  aLink.href = node.url;
  aLink.target = "_blank";
  aLink.innerText = node.title;

  spanAction.classList.add("me-3");
  spanAction.textContent = String.fromCharCode(160);

  /** Event Handlers */

  li.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === inputCheckbox) {
      return;
    }
    inputCheckbox.checked = !inputCheckbox.checked;
    toggleCheckedNode(node, CHECKED_NODES);
  });

  li.addEventListener("mouseover", function (event) {
    this.classList.add("bg-body-tertiary");
  });

  li.addEventListener("mouseleave", function (event) {
    this.classList.remove("bg-body-tertiary");
  });

  inputCheckbox.addEventListener("change", (event) => {
    console.log("change event on checkbox");
    event.stopPropagation();
    toggleCheckedNode(node, CHECKED_NODES);
  });

  aLink.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  divFolder.appendChild(spanAction);
  divFolder.appendChild(divFormCheck);
  labelForCheckbox.appendChild(aLink);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  li.appendChild(divFolder);

  return li;
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

  const li = document.createElement("li");
  const divFolder = document.createElement("div");
  const divFormCheck = document.createElement("div");
  const inputCheckbox = document.createElement("input");
  const labelForCheckbox = document.createElement("label");
  const spanAction = document.createElement("span");
  const strong = document.createElement("strong");
  const divChildren = document.createElement("div");
  const ul = document.createElement("ul");

  li.classList.add("list-group-item");
  li.id = `node-${node.id}`;

  const liAttributes = {
    "data-bmb-id": node.id,
    "data-bmb-title": node.title,
    "data-bmb-date-added": node.dateAdded,
    "data-bmb-type": "folder",
    "data-bmb-children-id": childrenId,
    "data-bmb-url": "",
  };

  Object.entries(liAttributes).forEach(([key, val]) => li.setAttribute(key, val));

  divFolder.classList.add("d-flex", "align-items-center");

  divFormCheck.classList.add("form-check");

  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.id = node.id;
  inputCheckbox.checked = node.checked;

  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.htmlFor = node.id;

  spanAction.classList.add("me-2");
  spanAction.textContent = String.fromCharCode(9654);
  spanAction.role = "button";
  spanAction.setAttribute("data-bmb-folder-icon-expanded", 0);

  strong.innerText = node.title || "<Unnamed Folder>";

  divChildren.classList.add("collapse", "ms-2", "show");
  divChildren.setAttribute("data-bmb-children-container", node.children.length);

  ul.classList.add("list-group", "list-group-flush");
  ul.id = childrenId;
  ul.setAttribute("data-bmb-expanded", 0);

  /** Event Handlers */

  li.addEventListener("mouseover", function (event) {
    this.classList.add("bg-body-tertiary");
  });

  li.addEventListener("mouseleave", function (event) {
    this.classList.remove("bg-body-tertiary");
  });

  // Add click event to li so when the li is cllicked it checks the box.
  li.addEventListener("click", async function (event) {
    event.stopPropagation();
    if (event.target === inputCheckbox) {
      return;
    }
    await handleNodeCollapseOrExpand(node, ul);
  });

  // Expand/collapse node + get child nodes
  spanAction.addEventListener("click", async function (event) {
    event.stopPropagation();
    try {
      await handleNodeCollapseOrExpand(node, ul);
    } catch (e) {
      console.error(e);
    }
  });

  inputCheckbox.addEventListener("change", (event) => {
    event.stopPropagation();
    toggleCheckedNode(node, CHECKED_NODES);
  });

  divChildren.appendChild(ul);
  labelForCheckbox.appendChild(strong);
  divFormCheck.appendChild(inputCheckbox);
  divFormCheck.appendChild(labelForCheckbox);
  divFolder.appendChild(spanAction);
  divFolder.appendChild(divFormCheck);
  li.appendChild(divFolder);
  li.appendChild(divChildren);

  return li;
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
    case "Folders First":
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

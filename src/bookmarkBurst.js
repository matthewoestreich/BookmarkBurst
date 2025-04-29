import browser from "webextension-polyfill";
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

let BOOKMARKS_TREE = [];

class BookmarkNode {
  path = [];

  /**
   * BookmarkNode is our internal symbolic representation of the builtin type  `bookmarks.BookmarkTreeNode`.
   * We use these nodes to track state (eg. checked, collapsed, etc..), as well as to render the bookmarks
   * tree.
   * @param {bookmarks.BookmarkTreeNode} node
   * @param {boolean} checked
   * @param {boolean} collapsed
   * @param {BookmarkNode[]} children
   */
  constructor(node, checked = false, collapsed = true, children = []) {
    this.id = node.id;
    this.title = node.title;
    this.url = node.url;
    this.checked = checked;
    this.collapsed = collapsed;
    this.dateAdded = node.dateAdded;
    this.unmodifiable = node.unmodifiable;
    this.children = children;
  }
}

/**
 * @typedef {BookmarkNode[]} SymbolicBookmarkTree
 */

const elBookmarksList = document.getElementById("bookmarks-list");
const elFindDeadBookmarksTab = document.getElementById("menu-tab-detect-dead-bookmarks");
const elOpenSelectedBookmarks = document.getElementById("open-selected-bookmarks");
const elClearSelectedBookmarks = document.getElementById("clear-all-selected");
const elOpenViewSelectBookmarksModal = document.getElementById("open-modal-view-selected-bookmarks");
const elListSelectedBookmarksInModal = document.getElementById("list-modal-view-selected-bookmarks");
const elSortBookmarksOptions = document.getElementById("sort-bookmarks");
const elFindDuplicates = document.getElementById("start-find-duplicates");
const elFindDuplicatesByOptions = document.getElementById("find-duplicates-by");
const elDetectDeadBookmarks = document.getElementById("start-detect-dead-bookmarks");
const elFoundDuplicatesList = document.getElementById("duplicates-list");
const elDuplicatesStatusLabel = document.getElementById("number-of-duplicates-found");

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  BOOKMARKS_TREE = generateSymbolicTree(root.children);
  // By default sort by folders first.
  sortNodesByFolder(BOOKMARKS_TREE);
  renderTree(BOOKMARKS_TREE, elBookmarksList);
});

elFindDeadBookmarksTab.addEventListener("click", async () => {
  const hasPermissions = await browser.permissions.request({
    origins: ["<all_urls>"],
  });
  if (!hasPermissions) {
    console.error(`[BookmarkBurst][find-dead-bookmarks] Permissions denied!`);
    elDetectDeadBookmarks.disabled = true;
    return;
  }
  elDetectDeadBookmarks.disabled = false;
  console.log(`[BookmarkBurst][find-dead-bookmarks] Permissions granted!`);
});

// Handle open selected bookmarks in new tabs.
elOpenSelectedBookmarks.addEventListener("click", () => {
  const allChecked = getCheckedBookmarkNodes(BOOKMARKS_TREE);
  for (const checked of allChecked) {
    if (!checked.url) {
      continue;
    }
    browser.tabs.create({ url: checked.url });
  }
});

// Handle open review selected bookmarks.
elOpenViewSelectBookmarksModal.addEventListener("click", () => {
  const allChecked = getCheckedBookmarkNodes(BOOKMARKS_TREE);
  elListSelectedBookmarksInModal.replaceChildren();
  for (const checked of allChecked) {
    if (!checked.url) {
      continue;
    }
    const li = document.createElement("li");
    li.classList.add("list-group-item");
    li.innerText = checked.title;
    elListSelectedBookmarksInModal.appendChild(li);
  }
});

// Handle button uncheck all click
elClearSelectedBookmarks.addEventListener("click", () => {
  for (const node of BOOKMARKS_TREE) {
    setCheckedRecursively(node, false, false);
  }
  renderTree(BOOKMARKS_TREE, elBookmarksList);
});

// Handle sort select change
elSortBookmarksOptions.addEventListener("change", (event) => {
  switch (event.target.value) {
    case "Folders First": {
      sortNodesByFolder(BOOKMARKS_TREE);
      break;
    }
    case "Date Added": {
      sortNodesByDateAdded(BOOKMARKS_TREE);
      break;
    }
    case "Alphabetical": {
      sortNodesAlphabetically(BOOKMARKS_TREE);
      break;
    }
    default: {
      sortNodesByFolder(BOOKMARKS_TREE);
      break;
    }
  }
  renderTree(BOOKMARKS_TREE, elBookmarksList);
});

// Clear duplicate results message when selection changes
elFindDuplicatesByOptions.addEventListener("change", () => {
  elDuplicatesStatusLabel.innerText = "";
  elFoundDuplicatesList.replaceChildren();
});

// Handle start finding duplicates..
elFindDuplicates.addEventListener("click", () => {
  const findby = elFindDuplicatesByOptions.value;
  if (!findby) {
    return;
  }

  const duplicates = findDuplicateBookmarks(BOOKMARKS_TREE, findby);
  const duplicateEntries = Object.entries(duplicates);
  const duplicateEntriesLength = duplicateEntries.length;

  if (!duplicateEntriesLength) {
    elDuplicatesStatusLabel.innerText = `No duplicates found!`;
    return;
  }

  elDuplicatesStatusLabel.innerText = `${duplicateEntriesLength} duplicate${duplicateEntriesLength > 1 ? "s" : ""} found!`;
  elFoundDuplicatesList.replaceChildren();

  for (const [target, nodes] of duplicateEntries) {
    // Wrap the duplicate bookmark html in a col
    const col = document.createElement("div");
    col.classList.add("col-12", "col-xl-6");
    const duplicateHTML = generateDuplicateBookmarksHTML(target, findby, nodes);
    col.appendChild(duplicateHTML);
    elFoundDuplicatesList.appendChild(col);
  }
});

// Find bookmarks that have dead urls
elDetectDeadBookmarks.addEventListener("click", async () => {
  try {
    const result = await browser.runtime.sendMessage({
      event: "detect-dead-bookmarks",
      bookmarks: findAllBookmarks(BOOKMARKS_TREE),
      timeout: 5000,
    });
  } catch (e) {
    console.error(`[BookmarkBurst][detect-dead-bookmarks] something went wrong!`, e);
  }
});

/**
 * Finds duplicates by URL or title. Only reports duplicate bookmarks, not folders.
 * @param {BookmarkNode[]} nodes
 * @param {"url" | "title"} findBy
 * @param {string[]} currentPath : typically won't be used by caller. This is to
 * return the path for any duplicate nodes so a user knows which bookmark they will
 * be potentially removing.
 * @returns {{ [k: string]: BookmarkNode[] }}
 */
function findDuplicateBookmarks(nodes, findBy = "url" | "title") {
  const allBookmarks = findAllBookmarks(nodes);
  const cache = {};

  for (const bmark of allBookmarks) {
    const findByStr = bmark[findBy];
    if (!cache[findByStr]) {
      cache[findByStr] = [];
    }
    cache[findByStr].push(bmark);
  }

  const duplicates = {};
  for (const [targetStr, duplicateNodes] of Object.entries(cache)) {
    if (duplicateNodes.length > 1) {
      duplicates[targetStr] = duplicateNodes;
    }
  }
  return duplicates;
}

/**
 * Recursively finds all bookmarks
 * @param {SymbolicBookmarkTree} nodes
 * @param {string[]} currentPath : typically not to be used by caller, we use it to track current path.
 * @returns {BookmarkNode[]}
 */
function findAllBookmarks(nodes, currentPath = []) {
  const output = [];
  for (const node of nodes) {
    if (!node.url) {
      if (node.children?.length) {
        const childBookmarks = findAllBookmarks(node.children, [...currentPath, node.title]);
        output.push(...childBookmarks);
      }
    }
    if (node.url) {
      node.path = [...currentPath, node.title];
      output.push(node);
    }
  }
  return output;
}

/**
 * You will still need to call the render function after this.
 * @param {*} event
 * @param {BookmarkNode} node
 * @returns
 */
function handleCheckboxChange(event, node) {
  if (!node) {
    return;
  }
  // Folder
  if (!node.url) {
    // If node is collapsed, force it to expand.
    node.collapsed = false;
    setCheckedRecursively(node, event.target.checked);
  }
  // Bookmark
  if (node.url) {
    node.checked = !node.checked;
  }
}

/**
 * Gets all checked nodes recursively.
 * @param {BookmarkNode[]} root
 * @returns
 */
function getCheckedBookmarkNodes(nodes = []) {
  const output = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.url && node.children) {
      const checkedChildren = getCheckedBookmarkNodes(node.children);
      if (checkedChildren && checkedChildren.length > 0) {
        output.push(...checkedChildren);
      }
    }
    if (node.checked) {
      output.push(node);
    }
  }

  return output;
}

/**
 * Recursively sets checked state of nodes.
 * If `skipFolders` is true (it is by default) we do not check the contents
 * of child folders. Only immediate bookmarks within `node` are checked.
 * @param {BookmarkNode} node
 * @param {boolean} checked
 * @param {boolean} skipFolders
 */
function setCheckedRecursively(node, checked, skipFolders = true) {
  node.checked = checked;

  if (node.children) {
    for (const child of node.children) {
      // Only check child bookmarks
      if (!child.url && skipFolders) {
        continue;
      }
      setCheckedRecursively(child, checked, skipFolders);
    }
  }
}

/**
 * Generates symbolic state we use to manage UI.
 * Accepts built-in `bookmarks.BookmarkTreeNode[]` type.
 * @param {BookmarkTreeNode[]} nodes
 * @returns {SymbolicBookmarkTree}
 */
function generateSymbolicTree(nodes) {
  const output = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // Filter only folders and bookmarks
    // Only Firefox has a node type of "separator".
    if (node.type === "separator") {
      continue;
    }
    const children = node.children ? generateSymbolicTree(node.children) : [];
    const newNode = new BookmarkNode(node, false, true, children);
    output.push(newNode);
  }

  return output;
}

/**
 * Prioritize folders above bookmarks.
 * @param {SymbolicBookmarkTree} nodes
 */
function sortNodesByFolder(nodes) {
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
  for (const node of nodes) {
    if (node.children) {
      sortNodesByFolder(node.children);
    }
  }
}

/**
 * Sort by date added as bookmark.
 * @param {SymbolicBookmarkTree} nodes
 */
function sortNodesByDateAdded(nodes) {
  nodes.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
  for (const node of nodes) {
    if (node.children) {
      sortNodesByDateAdded(node.children);
    }
  }
}

/**
 * Sort alphabetically (accounting for special characters and case).
 * @param {SymbolicBookmarkTree} nodes
 */
function sortNodesAlphabetically(nodes) {
  nodes.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  for (const node of nodes) {
    if (node.children) {
      sortNodesAlphabetically(node.children);
    }
  }
}

/**
 * The method that renders our symbolic state/tree to the DOM.
 * @param {SymbolicBookmarkTree} nodes
 * @param {HTMLUListElement} parentElement
 */
function renderTree(nodes, parentElement) {
  parentElement.replaceChildren();

  for (const node of nodes) {
    // Bookmark
    if (node.url) {
      const bookmark = generateBookmarkHTML(node);
      if (!bookmark) {
        return;
      }
      parentElement.appendChild(bookmark);
    }
    // Folder
    if (!node.url) {
      const folder = generateFolderHTML(node);
      if (!folder) {
        continue;
      }
      if (node.children && node.children.length > 0) {
        renderTree(node.children, folder.querySelector("ul"));
      }
      parentElement.appendChild(folder);
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
  li.classList.add("list-group-item");

  const divFolder = document.createElement("div");
  divFolder.classList.add("d-flex", "align-items-center");

  const divFormCheck = document.createElement("div");
  divFormCheck.classList.add("form-check");

  const inputCheckbox = document.createElement("input");
  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.id = node.id;
  inputCheckbox.checked = node.checked;
  inputCheckbox.addEventListener("change", (event) => {
    handleCheckboxChange(event, node);
    renderTree(BOOKMARKS_TREE, elBookmarksList);
  });

  const labelForCheckbox = document.createElement("label");
  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.htmlFor = node.id;

  const aLink = document.createElement("a");
  aLink.href = node.url;
  aLink.target = "_blank";
  aLink.innerText = node.title;

  // For bookmarks it acts as a spacer to align checkboxes with folders as bookmarks have greater margin than folders.
  // This is to account for the 'expand/collapse arrow' that folders have. For folders this is the expand/collapse button.
  const spanAction = document.createElement("span");
  spanAction.classList.add("me-3");
  spanAction.textContent = String.fromCharCode(160);

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
 * @param {BookmarkNode} node
 * @returns {HTMLLIElement}
 */
function generateFolderHTML(node) {
  if (node.url) {
    console.warn(`[BookmarkBurst] cannot generate folder HTML using bookmark node!`);
    return null;
  }

  const li = document.createElement("li");
  li.classList.add("list-group-item");

  const divFolder = document.createElement("div");
  divFolder.classList.add("d-flex", "align-items-center");

  const divFormCheck = document.createElement("div");
  divFormCheck.classList.add("form-check");

  const inputCheckbox = document.createElement("input");
  inputCheckbox.classList.add("form-check-input");
  inputCheckbox.type = "checkbox";
  inputCheckbox.id = node.id;
  inputCheckbox.checked = node.checked;
  inputCheckbox.addEventListener("change", (event) => {
    handleCheckboxChange(event, node);
    renderTree(BOOKMARKS_TREE, elBookmarksList);
  });

  const labelForCheckbox = document.createElement("label");
  labelForCheckbox.classList.add("form-check-label");
  labelForCheckbox.htmlFor = node.id;

  const collapseId = `collapse-${node.id}`;

  // For folders this is the arrow button.
  // For bookmarks it acts as a spacer to align checkboxes with folders.
  const spanAction = document.createElement("span");
  spanAction.classList.add("me-2");
  spanAction.setAttribute("href", `#${collapseId}`);
  spanAction.textContent = String.fromCharCode(9654);
  spanAction.setAttribute("data-bs-toggle", "collapse");
  spanAction.role = "button";
  spanAction.ariaExpanded = !node.collapsed;
  spanAction.setAttribute("aria-controls", collapseId);
  spanAction.addEventListener("click", () => {
    // Toggle folder collapsed state.
    node.collapsed = !node.collapsed;
  });

  const strong = document.createElement("strong");
  strong.innerText = node.title || "<Unnamed Folder>";

  const divChildren = document.createElement("div");
  divChildren.classList.add("collapse", "ms-2");
  divChildren.id = collapseId;
  divChildren.classList.add("show");
  if (node.collapsed) {
    divChildren.classList.remove("show");
  }

  const ul = document.createElement("ul");
  ul.classList.add("list-group", "list-group-flush");

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
 * Generaetes HTML for duplicate bookmarks.
 * @param {string} duplicateTarget : the string of the thing that is a duplicate (the url or title)
 * @param {BookmarkNode[]} nodes : an array of the duplicates
 */
function generateDuplicateBookmarksHTML(duplicateTarget, targetType = "url" | "title", nodes) {
  if (!nodes.length) {
    return null;
  }

  const card = document.createElement("div");
  card.classList.add("card", "m-2");
  card.style.height = "320px";

  const cardBody = document.createElement("div");
  cardBody.classList.add("card-body", "overflow-scroll");

  const cardTitle = document.createElement("div");
  cardTitle.classList.add("card-title");

  const cardSubTitle = document.createElement("p");
  cardSubTitle.classList.add("small", "mb-1");
  cardSubTitle.innerText = `Duplicate ${targetType === "url" ? "URL" : "Title"} Found`;

  const cardTitleText = document.createElement("h5");
  cardTitleText.innerText = duplicateTarget;

  const ul = document.createElement("ul");
  ul.classList.add("list-group");

  cardTitle.appendChild(cardSubTitle);
  cardTitle.appendChild(cardTitleText);
  cardBody.appendChild(cardTitle);

  for (const node of nodes) {
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "flex-row", "align-items-center");

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("btn", "btn-danger", "ms-auto", "btn-sm");
    deleteButton.disabled = !!node.unmodifiable;
    deleteButton.addEventListener("click", async () => {
      if (!confirm("Select 'Ok' to confirm deletion")) {
        return;
      }
      try {
        await browser.bookmarks.remove(node.id);
        li.remove();
      } catch (e) {
        console.error(e);
      }
    });

    const deleteIcon = document.createElement("i");
    deleteIcon.classList.add("bi", "bi-trash");

    const detailsList = document.createElement("ul");
    detailsList.classList.add("list-group");

    // If target is URL then this will be the Title.
    // If target is Title then this will be the URL.
    const targetComplimentText = document.createElement("li");
    targetComplimentText.classList.add("list-group-item", "text-start", "word-break-all", "me-2", "border-0");
    targetComplimentText.innerText = targetType === "url" ? node.title : node.url;

    const targetTypeLabel = document.createElement("b");
    targetTypeLabel.classList.add("small");
    targetTypeLabel.innerText = targetType === "url" ? "Title: " : "URL: ";

    const bookmarkPath = document.createElement("li");
    bookmarkPath.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-0", "pe-0");

    const pathPrefix = document.createElement("b");
    pathPrefix.innerText = "Path: ";

    const pathSuffix = document.createElement("p");
    pathSuffix.classList.add("text-start", "word-break-all", "small", "m-0");
    pathSuffix.innerText = `${node.path.join(` ${String.fromCharCode(8594)} `)}`;

    targetComplimentText.prepend(targetTypeLabel);
    pathSuffix.prepend(pathPrefix);
    bookmarkPath.appendChild(pathSuffix);
    detailsList.appendChild(targetComplimentText);
    detailsList.appendChild(bookmarkPath);
    deleteButton.appendChild(deleteIcon);
    li.appendChild(detailsList);
    li.appendChild(deleteButton);
    ul.appendChild(li);
  }

  cardBody.appendChild(ul);
  card.appendChild(cardBody);

  return card;
}

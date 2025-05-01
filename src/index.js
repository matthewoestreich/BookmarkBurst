import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

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
 * @typedef {"url" | "title"} UrlOrTitleStringLiteral
 * @typedef {BookmarkNode[]} SymbolicBookmarkTree
 * @typedef {{
 *  title: string;
 *  message: string;
 *  okButtonText: string;
 *  closeButtonText: string;
 *  onOkButtonClick: (ev: MouseEvent) => any
 * }} CreateConfirmationModalProperties
 */

/** @type {SymbolicBookmarkTree} */
let BOOKMARKS_TREE = [];

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
const elToggleThemeButton = document.getElementById("toggle-theme");
const elModalEditBookmarkSave = document.getElementById("modal-edit-bookmark-save-button");
const elModalEditBookmarkBookmarkData = document.getElementById("bookmark-data");
const elModalEditBookmarkUrlInput = document.getElementById("modal-edit-bookmark-url");
const elModalEditBookmarkTitleInput = document.getElementById("modal-edit-bookmark-title");
const elModalEditBookmarkClose = document.getElementById("modal-edit-bookmark-close-button");
const elModalEditBookmarkAlert = document.getElementById("modal-edit-bookmark-alert");
const elOpenManySearchTextInput = document.getElementById("open-many-tab-search-text");
const elOpenManySearchByOptions = document.getElementById("open-many-tab-search-by");
const elOpenManyStartSearch = document.getElementById("open-many-tab-start-search");

/**
 * =========================================================================================================
 * Event Handlers
 * =========================================================================================================
 */

browser.bookmarks.onChanged.addListener((id, changeInfo) => {
  updateNode(BOOKMARKS_TREE, id, changeInfo);
});

browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  // TODO : how we handle bookmark deletion is not very efficient..
  // When a single bookmark is deleted we generate the entire tree from scratch again,
  // then parse it for dupliates again... horribly inefficient...
  BOOKMARKS_TREE = await initializeBookmarkTree();
  sortNodesAlphabetically(BOOKMARKS_TREE);
  // Parse tree for duplixates again
  elFindDuplicates.click();
});

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  BOOKMARKS_TREE = await initializeBookmarkTree();
  // By default sort by folders first.
  sortNodesByFolder(BOOKMARKS_TREE);
  renderTree(BOOKMARKS_TREE, elBookmarksList);
});

elToggleThemeButton.addEventListener("click", () => {
  // If we are in dark mode, we need to show the light mode icon.
  const darkModeIcon = "bi-sun-fill";
  // If we are in light mode, we need to show the dark mode icon.
  const lightModeIcon = "bi-moon-stars-fill";
  const elThemeIcon = document.getElementById("theme-icon");
  const currentTheme = document.documentElement.getAttribute("data-bs-theme");
  if (currentTheme === "dark") {
    // Current theme is dark, we are switching to light.
    document.documentElement.setAttribute("data-bs-theme", "light");
    elThemeIcon.classList.remove(darkModeIcon);
    elThemeIcon.classList.add(lightModeIcon);
  } else {
    // Current theme is light, we are switching to dark.
    document.documentElement.setAttribute("data-bs-theme", "dark");
    elThemeIcon.classList.remove(lightModeIcon);
    elThemeIcon.classList.add(darkModeIcon);
  }
});

// Find dead urls
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
elOpenSelectedBookmarks.addEventListener("click", async () => {
  try {
    const currentTab = await browser.tabs.getCurrent();
    const allChecked = getCheckedBookmarkNodes(BOOKMARKS_TREE);
    for (let i = 0, tabIndex = currentTab.index + 1; i < allChecked.length; i++, tabIndex++) {
      const checked = allChecked[i];
      if (!checked.url) {
        continue;
      }
      browser.tabs.create({ url: checked.url, index: tabIndex });
    }
  } catch (e) {
    console.error(`[BookmarkBurst][open-selected-bookmarks]`, e);
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
    const duplicateHTML = generateDuplicateBookmarksHTML(nodes, findby);
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

// Modal edit bookmark : save edited bookmark changes
elModalEditBookmarkSave.addEventListener("click", async () => {
  const id = elModalEditBookmarkBookmarkData.getAttribute("data-bookmark-id");

  if (!id) {
    elModalEditBookmarkAlert.classList.add("alert-danger");
    elModalEditBookmarkAlert.innerText = "Error! Something went wrong!";
    console.error(`[BookmarkBlast][edit-bookmark-modal-save] Bookmark ID not found!`);
    return;
  }

  const originalUrl = elModalEditBookmarkBookmarkData.getAttribute("data-bookmark-url");
  const originalTitle = elModalEditBookmarkBookmarkData.getAttribute("data-bookmark-title");
  const target = elModalEditBookmarkBookmarkData.getAttribute("data-bookmark-target-field");
  const url = elModalEditBookmarkUrlInput.value;
  const title = elModalEditBookmarkTitleInput.value;

  try {
    await browser.bookmarks.update(id, { url, title });

    elModalEditBookmarkAlert.classList.add("alert-success");
    elModalEditBookmarkAlert.innerText = "Successfully edited bookmark!";

    // As an example, lets say the 'title' field is the duplicate. If the user edits it, that means it is no longer
    // a duplicate (if it isn't the same as the original) and we can remove that node from the display.
    if ((target === "url" && originalUrl !== url) || (target === "title" && originalTitle !== title)) {
      // Rerun duplicate bookmark check to 'refresh' our duplicate results.
      elFindDuplicates.click();
      return;
    }

    const elNodeTitle = document.getElementById(`${id}-title`);
    if (elNodeTitle) {
      // Place string in front of title, otherwise it renders like this; `Title:Foo Title` instead of `Title: Foo Title`.
      elNodeTitle.innerText = `${String.fromCharCode(160)}${title}`;
    }

    const elNodeUrl = document.getElementById(`${id}-url`);
    if (elNodeUrl) {
      // Place string in front of URL, otherwise it renders like this; `URL:https://bar.com` instead of `URL: https://bar.com`.
      elNodeUrl.innerText = `${String.fromCharCode(160)}${url}`;
    }
  } catch (e) {
    elModalEditBookmarkAlert.classList.add("alert-danger");
    elModalEditBookmarkAlert.innerText = "Error! Something went wrong!";
    console.error(`[BookmarkBlast][edit-bookmark-modal-save] Error saving bookmark!`, e);
  }
});

// Modal edit bookmark : close modal button. To clear data and inputs
elModalEditBookmarkClose.addEventListener("click", () => {
  elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-id", "");
  elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-target-field", "");
  elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-url", "");
  elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-title", "");
  elModalEditBookmarkTitleInput.value = "";
  elModalEditBookmarkUrlInput.value = "";
  elModalEditBookmarkAlert.setAttribute("class", "");
  elModalEditBookmarkAlert.innerText = "";
});

elOpenManyStartSearch.addEventListener("click", () => {
  const queryString = elOpenManySearchTextInput.value.trim();
  if (!queryString || queryString === "") {
    return;
  }
  const searchBy = elOpenManySearchByOptions.value.toLowerCase();
  const flattened = flattenBookmarksTree(BOOKMARKS_TREE);
  console.log({ flattened });
  const threshold = searchBy === "title" ? 4 : 20;
  const searchResults = fuzzySearchBookmarks(flattened, searchBy, queryString, threshold);
  console.log({ searchResults });
});

/**
 * =========================================================================================================
 * Functions
 * =========================================================================================================
 */

/**
 * Fuzzy search our bookmarks using Levenshtein distance algo.
 * @param {BookmarkNode[]} bookmarks : flattened array of bookmarks
 * @param {UrlOrTitleStringLiteral} searchBy : are we searching for titles or urls?
 * @param {string} query : search query
 * @param {number} threshold :
 */
function fuzzySearchBookmarks(bookmarks, searchBy, query, threshold = 3) {
  query = query.trim().toLowerCase();

  return bookmarks.filter((bookmark) => {
    const candidate = bookmark[searchBy]?.toLowerCase();
    if (!candidate) {
      return false;
    }
    if (query.length > 2 && candidate.includes(query)) {
      return true;
    }

    // Levenshtein
    const dp = Array.from({ length: candidate.length + 1 }, () => []);
    for (let i = 0; i <= candidate.length; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= query.length; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= candidate.length; i++) {
      for (let j = 1; j <= query.length; j++) {
        if (candidate[i - 1] === query[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // Deletion
            dp[i][j - 1] + 1, // Insertion
            dp[i - 1][j - 1] + 1, // Substitution
          );
        }
      }
    }

    return dp[candidate.length][query.length] <= threshold;
  });
}

/**
 * Generates entire symbolic tree from scratch
 * @returns {Promise<SymbolicBookmarkTree>}
 */
async function initializeBookmarkTree() {
  const bookmarksTree = await browser.bookmarks.getTree();
  const root = bookmarksTree[0];
  return Promise.resolve(generateSymbolicTree(root.children));
}

/**
 * Lets you configure a confirmation dialog and returns a `bootstrap.Modal` instance.
 * @param {CreateConfirmationModalProperties} props
 * @returns {bootstrap.Modal}
 */
function createConfirmationModal(props) {
  const { titleText, okButtonText, closeButtonText, messageText, handleOkButtonClick } = props;

  const elModalConfirm = document.getElementById("modal-confirm");
  const elModalConfirmTitle = document.getElementById("modal-confirm-title");
  const elModalConfirmMessage = document.getElementById("modal-confirm-message");
  const elModalConfirmCloseButton = document.getElementById("modal-confirm-close-button");
  const elModalConfirmOkButton = document.getElementById("modal-confirm-ok-button");

  if (!elModalConfirm || !elModalConfirmTitle || !elModalConfirmMessage || !elModalConfirmCloseButton || !elModalConfirmOkButton) {
    return null;
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(elModalConfirm);

  elModalConfirmTitle.innerText = titleText;
  elModalConfirmOkButton.innerText = okButtonText;
  elModalConfirmCloseButton.innerText = closeButtonText;
  elModalConfirmMessage.innerText = messageText;

  elModalConfirmOkButton.addEventListener(
    "click",
    (e) => {
      bsModal.hide();
      handleOkButtonClick(e);
    },
    { once: true },
  );

  elModalConfirmCloseButton.addEventListener(
    "click",
    () => {
      bsModal.hide();
    },
    { once: true },
  );

  return bsModal;
}

/**
 * Update a node.
 * @param {BookmarkNode[]} nodes
 * @param {string} nodeId
 * @param {{}} newProps : object containing new props+values
 * @returns
 */
function updateNode(nodes, nodeId, newProps = {}) {
  for (let node of nodes) {
    if (node.id === nodeId) {
      for (const [prop, value] of Object.entries(newProps)) {
        node[prop] = value;
      }
      return;
    }
    if (node.children?.length) {
      updateNode(node.children, nodeId, newProps);
    }
  }
}

/**
 * Finds duplicates by URL or title. Only reports duplicate bookmarks, not folders.
 * @param {BookmarkNode[]} nodes
 * @param {UrlOrTitleStringLiteral} findBy : "url" or "title"
 * @returns {{ [k: string]: BookmarkNode[] }} : where the key `k` is the target string (the
 * url or title) that is the duplicate (if two bookmarks had "google.com" as the URL `k`
 * would be "google.com" - if two bookmarks had "Foo" as the title, `k` would be "Foo") and
 * the value `BookmarkNode[]` is the duplicate nodes.
 */
function findDuplicateBookmarks(nodes, findBy) {
  if (findBy !== "url" && findBy !== "title") {
    console.error(`[BookmarkBurst][find-duplicate-bookmarks] invalid 'findBy' param. Expected "url" or "title" | got= '${findBy}'`);
    return;
  }

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
 * Flattens our tree into an array
 * @param {SymbolicBookmarkTree} tree
 * @returns {BookmarkNode[]}
 */
function flattenBookmarksTree(tree) {
  const output = [];
  for (const node of tree) {
    output.push(node);
    if (node.children?.length) {
      output.push(...flattenBookmarksTree(node.children));
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
  li.classList.add("list-group-item", "word-break-all");

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
  //aLink.classList.add("overflow-hidden", "text-nowrap", "text-truncate", "d-inline-block", "w-100");
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
 * @param {BookmarkNode[]} nodes : an array of the duplicates
 * @param {UrlOrTitleStringLiteral} targetType : either "url" or "title"
 */
function generateDuplicateBookmarksHTML(nodes, targetType) {
  if (targetType !== "url" && targetType !== "title") {
    console.error(`[BookmarkBurst][generate-duplicate-bookmarks-html] invalid 'targetType' param. Expected "url" or "title" | got= '${targetType}'`);
    return null;
  }
  if (!nodes.length) {
    return null;
  }

  const card = document.createElement("div");
  card.classList.add("card", "m-2");
  card.style.height = "320px";

  const cardBody = document.createElement("div");
  cardBody.classList.add("card-body", "d-flex", "flex-column", "overflow-scroll");

  const cardTitle = document.createElement("div");
  cardTitle.classList.add("card-title");

  const cardSubTitle = document.createElement("p");
  cardSubTitle.classList.add("small", "mb-1");
  cardSubTitle.innerText = `${nodes.length} Duplicate ${targetType === "url" ? "URL" : "Title"}s Found`;

  const duplicatesListContainer = document.createElement("div");
  duplicatesListContainer.classList.add("flex-grow-1", "d-flex", "flex-column", "justify-content-center");

  const duplicatesList = document.createElement("ul");
  duplicatesList.classList.add("list-group");

  duplicatesListContainer.appendChild(duplicatesList);
  cardTitle.appendChild(cardSubTitle);
  cardBody.appendChild(cardTitle);
  cardBody.appendChild(duplicatesListContainer);

  for (const node of nodes) {
    const duplicateListItem = document.createElement("li");
    duplicateListItem.classList.add("list-group-item", "d-flex", "flex-row", "align-items-center");
    duplicateListItem.id = `${node.id}-list-item`;

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("btn", "btn-danger", "btn-sm", "ms-1");
    deleteButton.disabled = !!node.unmodifiable;
    deleteButton.addEventListener("click", async () => {
      const confirmationModal = createConfirmationModal({
        title: "Confirm Deletion",
        message: "Are you sure you want to delete this bookmark?",
        okButtonText: "Yes",
        closeButtonText: "No",
        onOkButtonClick: async () => {
          try {
            // The handler for the resulting event will take care of rerendering tree.
            await browser.bookmarks.remove(node.id);
          } catch (e) {
            console.log("ERROR!", { error: e, node });
          }
        },
      });
      if (confirmationModal) {
        confirmationModal.show();
      }
    });

    const deleteIcon = document.createElement("i");
    deleteIcon.classList.add("bi", "bi-trash");

    deleteButton.appendChild(deleteIcon);

    const editButton = document.createElement("button");
    editButton.classList.add("btn", "btn-primary", "ms-auto", "btn-sm");
    editButton.disabled = !!node.unmodifiable;
    editButton.setAttribute("data-bs-toggle", "modal");
    editButton.setAttribute("data-bs-target", "#modal-edit-bookmark");
    editButton.addEventListener("click", () => {
      elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-url", node.url);
      elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-title", node.title);
      elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-id", node.id);
      elModalEditBookmarkBookmarkData.setAttribute("data-bookmark-target-field", targetType);
      elModalEditBookmarkUrlInput.value = node.url || "";
      elModalEditBookmarkTitleInput.value = node.title || "";
    });

    const editIcon = document.createElement("i");
    editIcon.classList.add("bi", "bi-pencil");

    editButton.appendChild(editIcon);

    const detailsList = document.createElement("ul");
    detailsList.classList.add("list-group", "small");

    const targetTextListItem = document.createElement("li");
    targetTextListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");

    const targetTextParagraph = document.createElement("p");
    targetTextParagraph.classList.add("text-start", "word-break-all", "mb-0");
    targetTextParagraph.id = `${node.id}-${targetType}`;
    targetTextParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.url : node.title}`;

    const targetTextBold = document.createElement("b");
    targetTextBold.innerText = targetType === "url" ? "URL: " : "Title: ";

    targetTextListItem.appendChild(targetTextBold);
    targetTextListItem.appendChild(targetTextParagraph);

    // If target is URL then this will be the Title.
    // If target is Title then this will be the URL.
    const targetComplimentListItem = document.createElement("li");
    targetComplimentListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");

    const targetComplimentParagraph = document.createElement("p");
    targetComplimentParagraph.classList.add("text-start", "word-break-all", "mb-0");
    targetComplimentParagraph.id = `${node.id}-${targetType === "url" ? "title" : "url"}`;
    targetComplimentParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.title : node.url}`;

    const targetComplimentBold = document.createElement("b");
    targetComplimentBold.innerText = targetType === "url" ? "Title: " : "URL: ";

    targetComplimentListItem.appendChild(targetComplimentBold);
    targetComplimentListItem.appendChild(targetComplimentParagraph);

    const bookmarkPathListItem = document.createElement("li");
    bookmarkPathListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1");

    const bookmarkPathBold = document.createElement("b");
    bookmarkPathBold.innerText = "Folder: ";

    const pathSuffix = document.createElement("p");
    pathSuffix.classList.add("text-start", "word-break-all", "m-0");
    node.path.pop();
    pathSuffix.innerText = `${node.path.join(` ${String.fromCharCode(8594)} `)}`;

    pathSuffix.prepend(bookmarkPathBold);
    bookmarkPathListItem.appendChild(pathSuffix);
    // So we keep the same format of "Title", "URL", "Folder"
    if (targetType === "url") {
      detailsList.appendChild(targetComplimentListItem);
      detailsList.appendChild(targetTextListItem);
    } else {
      detailsList.appendChild(targetTextListItem);
      detailsList.appendChild(targetComplimentListItem);
    }
    detailsList.appendChild(bookmarkPathListItem);
    duplicateListItem.appendChild(detailsList);
    duplicateListItem.appendChild(editButton);
    duplicateListItem.appendChild(deleteButton);
    duplicatesList.appendChild(duplicateListItem);
  }

  card.appendChild(cardBody);
  return card;
}

class BookmarkNode {
	path = [];
  /**
   * BookmarkNode is our internal symbolic representation of the builtin type  `bookmarks.BookmarkTreeNode`.
   * We use these nodes to track state (eg. checked, collapsed, etc..), as well as to render the bookmarks
   * tree.
   * @param {string} id
   * @param {string} title
   * @param {string | null} url
   * @param {boolean} checked
   * @param {boolean} collapsed
   * @param {number} dateAdded
   * @param {BookmarkNode[]} children
   */
  constructor(id = null, title = null, url = null, checked = false, collapsed = true, dateAdded, children = []) {
    this.id = id;
    this.title = title;
    this.url = url;
    this.checked = checked;
    this.collapsed = collapsed;
    this.dateAdded = dateAdded;
    this.children = children;
  }
}

/**
 * @typedef {BookmarkNode[]} SymbolicBookmarkTree
 */

const api = typeof browser === "undefined" ? chrome : browser;
let BOOKMARKS_TREE = [];

const ulBookmarksList = document.getElementById("bookmarks-list");
const btnOpenSelectedBookmarks = document.getElementById("open-selected-bookmarks");
const btnClearSelectedBookmarks = document.getElementById("clear-all-selected");
const btnOpenModalViewSelectedBookmarks = document.getElementById("open-modal-view-selected-bookmarks");
const listInModalViewSelectedBookmarks = document.getElementById("list-modal-view-selected-bookmarks");
const selectSortBookmarks = document.getElementById("sort-bookmarks");
const btnStartFindDuplicates = document.getElementById("start-find-duplicates");
const selectFindDuplicatesBy = document.getElementById("find-duplicates-by");

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
  const bookmarksTree = await api.bookmarks.getTree();
  const root = bookmarksTree[0];
  BOOKMARKS_TREE = generateSymbolicTree(root.children);
  // By default sort by folders first.
  sortNodesByFolder(BOOKMARKS_TREE);
  renderTree(BOOKMARKS_TREE, ulBookmarksList);
});

// Handle open selected bookmarks in new tabs.
btnOpenSelectedBookmarks.addEventListener("click", () => {
  const allChecked = getCheckedBookmarkNodes(BOOKMARKS_TREE);
  for (const checked of allChecked) {
    if (!checked.url) {
      continue;
    }
    api.tabs.create({ url: checked.url });
  }
});

// Handle open review selected bookmarks.
btnOpenModalViewSelectedBookmarks.addEventListener("click", () => {
  const allChecked = getCheckedBookmarkNodes(BOOKMARKS_TREE);
  listInModalViewSelectedBookmarks.replaceChildren();
  for (const checked of allChecked) {
    if (!checked.url) {
      continue;
    }
    const li = document.createElement("li");
    li.classList.add("list-group-item");
    li.innerText = checked.title;
    listInModalViewSelectedBookmarks.appendChild(li);
  }
});

// Handle button uncheck all click
btnClearSelectedBookmarks.addEventListener("click", () => {
  for (const node of BOOKMARKS_TREE) {
    setCheckedRecursively(node, false, false);
  }
  renderTree(BOOKMARKS_TREE, ulBookmarksList);
});

// Handle sort select change
selectSortBookmarks.addEventListener("change", (event) => {
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
  renderTree(BOOKMARKS_TREE, ulBookmarksList);
});

// Handle start finding duplicates..
btnStartFindDuplicates.addEventListener("click", () => {
  const findby = selectFindDuplicatesBy.value;
  if (!findby) {
    return;
  }

  const duplicates = findDuplicateBookmarks(BOOKMARKS_TREE, findby);
	const duplicateEntries = Object.entries(duplicates);

	if (!duplicateEntries.length) {
		return;
	} 

	const appendToElement = document.getElementById("duplicates-list");
	if (!appendToElement) {
		return;
	}

	appendToElement.replaceChildren();
	
	for (const [target, nodes] of duplicateEntries) {
		// Wrap the duplicate bookmark html in a col
		const col = document.createElement("div");
		col.classList.add("col-12", "col-xl-6");
		const duplicateHTML = generateDuplicateBookmarksHTML(target, nodes);
		col.appendChild(duplicateHTML);
		appendToElement.appendChild(col);
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
function findDuplicateBookmarks(nodes, findBy = "url" | "title", currentPath = []) {
  /** An element in `cache` has the following shape:
   * { "url|or|title": BookmarkNode[] } */
  const cache = {};
  for (const node of nodes) {
		if (!currentPath.length) {
			currentPath.push(node.title || "<unnamed folder>");
		} 

    if (!node.url) {
      if (node.children?.length) {
        const childCache = findDuplicateBookmarks(node.children, findBy, [...currentPath, node.title]);
        for (const [key, values] of Object.entries(childCache)) {
          if (!cache[key]) {
            cache[key] = values;
          } else {
						cache[key].push(...values);
					}
        }
      }
    } else {
      const key = node[findBy];
      if (!cache[key]) {
        cache[key] = [];
      }
      cache[key].push({ ...node, path: [...currentPath, node.title] });
    }
  }

  const duplicates = {};
  for (const [key, values] of Object.entries(cache)) {
    if (values.length > 1) {
      duplicates[key] = values;
    }
  }
  return duplicates;
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
    const newNode = new BookmarkNode(node.id, node.title, node.url, false, true, node.dateAdded, children);
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
    renderTree(BOOKMARKS_TREE, ulBookmarksList);
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
    renderTree(BOOKMARKS_TREE, ulBookmarksList);
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
function generateDuplicateBookmarksHTML(duplicateTarget, nodes) {
	if (!nodes.length) {
		return null;
	}

	const card = document.createElement("div");
	card.classList.add("card");

	const cardBody = document.createElement("div");
	cardBody.classList.add("card-body");

	const cardTitle = document.createElement("div");
	cardTitle.classList.add("card-title");
	cardTitle.innerText = duplicateTarget;

	cardBody.appendChild(cardTitle);
	card.appendChild(cardBody);

	return card;
}

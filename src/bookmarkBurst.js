const api = typeof browser === "undefined" ? chrome : browser;
let BOOKMARKS_TREE = [];

const ulBookmarksList = document.getElementById("bookmarks-list");
const btnOpenSelectedBookmarks = document.getElementById("open-selected-bookmarks");
const btnClearSelectedBookmarks = document.getElementById("clear-all-selected");
const btnOpenModalViewSelectedBookmarks = document.getElementById("open-modal-view-selected-bookmarks");
const listInModalViewSelectedBookmarks = document.getElementById("list-modal-view-selected-bookmarks");

class BookmarkNode {
	constructor(id = null, title = null, url = null, checked = false, collapsed = true, children = []) {
		this.id = id;
		this.title = title;
		this.url = url;
		this.checked = checked;
		this.collapsed = collapsed;
		this.children = children;
	}
}

// Page loaded...
document.addEventListener("DOMContentLoaded", async () => {
	const bookmarksTree = await api.bookmarks.getTree();
	const root = bookmarksTree[0];
	BOOKMARKS_TREE = generateSymbolicTree(root.children);
	renderTree(BOOKMARKS_TREE, ulBookmarksList);
});

btnOpenSelectedBookmarks.addEventListener("click", () => {
  const allChecked = getCheckedBookmarks(BOOKMARKS_TREE);
  for (const checked of allChecked) {
    if (!checked.url) {
      continue;
    }
    api.tabs.create({ url: checked.url });
  }
});

btnOpenModalViewSelectedBookmarks.addEventListener("click", () => {
  const allChecked = getCheckedBookmarks(BOOKMARKS_TREE);
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

btnClearSelectedBookmarks.addEventListener("click", () => {
  for (const node of BOOKMARKS_TREE) {
    setCheckedRecursively(node, false, false);
  }
  renderTree(BOOKMARKS_TREE, ulBookmarksList);
});

function handleCheckboxChange(event, node) {
	if (!node) {
		return;
	}

	// Found a folder
	if (!node.url) {
		// If node is collapsed, force it to expand.
		node.collapsed = false;
		setCheckedRecursively(node, event.target.checked);
	}
  // Found bookmark
  if (node.url) {
    node.checked = !node.checked;
  }

	renderTree(BOOKMARKS_TREE, ulBookmarksList);
}

function getCheckedBookmarks(root = []) {
  return recurse(root);

  function recurse(nodes) {
    const output = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.url && node.children) {
        const result = recurse(node.children);
        result.forEach(r => output.push(r));
      }
      if (node.checked) {
        output.push(node);
      }
    }

    return output;
  }
}

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

function generateSymbolicTree(rootNodes) {
	return recurse(rootNodes);

	function recurse(nodes) {
		const output = [];
		// Sort so folders are first
		sortNodes(nodes);

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			// Filter only folders and bookmarks
			if (node.type === "separator") {
				continue;
			}
			const newNode = new BookmarkNode(node.id, node.title, node.url, false, true, node.children ? recurse(node.children) : []);
			output.push(newNode);
		}

		return output;
	}
}

function renderTree(nodes, parentElement) {
	parentElement.replaceChildren();

	for (const node of nodes) {
		// Whether a bookmark or a folder, the element will need these.
		const li = document.createElement("li");
		li.classList.add("list-group-item");
		const divFormCheck = document.createElement("div");
		divFormCheck.classList.add("form-check");
		const inputCheckbox = document.createElement("input");
		inputCheckbox.classList.add("form-check-input");
		inputCheckbox.type = "checkbox";
		inputCheckbox.id = node.id;
		inputCheckbox.checked = node.checked;
    inputCheckbox.addEventListener("change", (event) => {
      handleCheckboxChange(event, node);
    });
		const labelForCheckbox = document.createElement("label");
		labelForCheckbox.classList.add("form-check-label");
		labelForCheckbox.htmlFor = node.id;

		// Found bookmark
		if (node.url) {
			const aLink = document.createElement("a");
			aLink.href = node.url;
			aLink.target = "_blank";
			aLink.innerText = node.title;
			labelForCheckbox.appendChild(aLink);
			divFormCheck.appendChild(inputCheckbox);
			divFormCheck.appendChild(labelForCheckbox);
			li.appendChild(divFormCheck);
			parentElement.appendChild(li);
		}

		// Folder
		if (!node.url) {
			const collapseId = `collapse-${node.id}`;
			const divFolder = document.createElement("div");
			divFolder.classList.add("d-flex", "align-items-center");
			const spanToggleCollapse = document.createElement("span");
			spanToggleCollapse.setAttribute("data-bs-toggle", "collapse");
			spanToggleCollapse.setAttribute("href", `#${collapseId}`);
			spanToggleCollapse.role = "button";
			spanToggleCollapse.ariaExpanded = !node.collapsed;
			spanToggleCollapse.setAttribute("aria-controls", collapseId);
			spanToggleCollapse.classList.add("me-2");
			spanToggleCollapse.textContent = String.fromCharCode(9654);
			spanToggleCollapse.addEventListener("click", () => {
				// Toggle folder collapsed state.
				node.collapsed = !node.collapsed;
			});
			const strong = document.createElement("strong");
			strong.innerText = node.title || "<Unnamed Folder>";
			const divChildren = document.createElement("div");
			divChildren.classList.add("collapse", "ms-4");
			divChildren.id = collapseId;
			if (node.collapsed) {
				divChildren.classList.remove("show");
			} else {
				divChildren.classList.add("show");
			}
			const ul = document.createElement("ul");
			ul.classList.add("list-group", "list-group-flush");
			divChildren.appendChild(ul);
			labelForCheckbox.appendChild(strong);
			divFormCheck.appendChild(inputCheckbox);
			divFormCheck.appendChild(labelForCheckbox);
			divFolder.appendChild(spanToggleCollapse);
			divFolder.appendChild(divFormCheck);
			li.appendChild(divFolder);
			li.appendChild(divChildren);

			if (node.children && node.children.length > 0) {
				renderTree(node.children, ul);
			}
		}

		parentElement.appendChild(li);
	}
}

function sortNodes(nodes) {
	nodes.sort((a, b) => {
		const aIsFolder = a.type === "folder";
		const bIsFolder = b.type === "folder";
		if (aIsFolder && !bIsFolder) {
			return -1;
		}
		if (!aIsFolder && bIsFolder) {
			return 1;
		}
		return (a.title || "").localeCompare(b.title || "");
	});
}

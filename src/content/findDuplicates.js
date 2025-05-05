import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

/**
 * @typedef {"title" | "url"} FindNodesBy
 * @typedef {{
 *  title: string;
 *  message: string;
 *  okButtonText: string;
 *  closeButtonText: string;
 *  onOkButtonClick: (ev: MouseEvent) => any
 * }} CreateConfirmationModalProperties
 */

/**
 * @implements {browser.Bookmarks.BookmarkTreeNode}
 */
class BookmarkTreeNodeExtended {
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

const elFindDuplicatesButton = document.getElementById("start-find-duplicates");
const elFindDuplicatesBySelect = document.getElementById("find-duplicates-by");
const elFindDuplicatesStatusLabel = document.getElementById("number-of-duplicates-found");
const elFoundDuplicatesList = document.getElementById("duplicates-list");

elFindDuplicatesButton.addEventListener("click", async () => {
  const findby = elFindDuplicatesBySelect.value;
  if (!findby) {
    return;
  }

  const tree = await browser.bookmarks.getTree();
  const rootNode = tree[0];
  const duplicates = findDuplicateBookmarksBy(rootNode.children, findby);
  const duplicateEntries = Object.entries(duplicates);
  const duplicateEntriesLength = duplicateEntries.length;

  if (!duplicateEntriesLength) {
    elFindDuplicatesStatusLabel.innerText = `No duplicates found!`;
    return;
  }

  elFindDuplicatesStatusLabel.innerText = `${duplicateEntriesLength} duplicate${duplicateEntriesLength > 1 ? "s" : ""} found!`;
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

/**
 * ==============================================================================================================================
 * FUNCTIONS
 * ==============================================================================================================================
 */

/**
 * Recursively finds all bookmarks.
 * @param {browser.Bookmarks.BookmarkTreeNode[] | BookmarkTreeNodeExtended[]} nodes
 * @param {string[]} currentPath : typically not to be used by caller, we use it to track current path.
 * @returns {BookmarkTreeNodeExtended[]}
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
 *
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {FindNodesBy} findBy
 */
function findDuplicateBookmarksBy(nodes, findBy) {
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
 * Lets you configure a confirmation dialog and returns a `bootstrap.Modal` instance.
 * @param {CreateConfirmationModalProperties} props
 * @returns {bootstrap.Modal}
 */
function createConfirmationModal(props) {
  const { title, okButtonText, closeButtonText, message, onOkButtonClick } = props;

  const elModalConfirm = document.getElementById("modal-confirm");
  const elModalConfirmTitle = document.getElementById("modal-confirm-title");
  const elModalConfirmMessage = document.getElementById("modal-confirm-message");
  const elModalConfirmCloseButton = document.getElementById("modal-confirm-close-button");
  const elModalConfirmOkButton = document.getElementById("modal-confirm-ok-button");

  if (!elModalConfirm || !elModalConfirmTitle || !elModalConfirmMessage || !elModalConfirmCloseButton || !elModalConfirmOkButton) {
    return null;
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(elModalConfirm);

  elModalConfirmTitle.innerText = title;
  elModalConfirmOkButton.innerText = okButtonText;
  elModalConfirmCloseButton.innerText = closeButtonText;
  elModalConfirmMessage.innerText = message;

  elModalConfirmOkButton.addEventListener(
    "click",
    (e) => {
      bsModal.hide();
      onOkButtonClick(e);
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
    const duplicateListItem = generateDuplicateBookmarkDetailsHTML(node, targetType);
    duplicatesList.appendChild(duplicateListItem);
  }

  card.appendChild(cardBody);
  return card;
}

/**
 *
 * @param {*} node
 * @param {UrlOrTitleStringLiteral} targetType
 */
function generateDuplicateBookmarkDetailsHTML(node, targetType) {
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

  return duplicateListItem;
}

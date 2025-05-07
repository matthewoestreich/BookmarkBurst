import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

import { sortRawNodes } from "./manageBookmarks.js";
import { createEditBookmarkModal } from "./editBookmarkModal.js";
import { createConfirmationModal } from "./confirmationModal.js";
import { createLoadingSpinner } from "./loadingSpinner.js";

/**
 * @typedef {"title" | "url"} TargetType
 * @typedef {"Folders First" | "Date Added Newest First" | "Date Added Newest Last" | "Alphabetical"} SortNodesBy
 */

/**
 * @implements {browser.Bookmarks.BookmarkTreeNode}
 */
class BookmarkTreeNodeExtended {
  path = [];

  /**
   * BookmarkNode is our internal symbolic representation of the builtin type  `bookmarks.BookmarkTreeNode`.
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
const elConfirmBookmarkDeletionCheckbox = document.getElementById("confirm-delete-bookmark");

browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  // Only rerun duplicates search if the "Duplicates" tab is active.
  if (document.getElementById("menu-tab-detect-duplicates")?.classList.contains("active")) {
    elFindDuplicatesButton.click();
  }
});

// Start finding duplicates
elFindDuplicatesButton.addEventListener("click", async () => {
  const findby = elFindDuplicatesBySelect.value;
  if (!findby) {
    return;
  }

  // Add loading spinner
  elFoundDuplicatesList.appendChild(createLoadingSpinner());

  const tree = await browser.bookmarks.getTree();
  const rootNode = tree[0];
  const nodes = rootNode.children;
  sortRawNodesRecursively(nodes, "Alphabetical");
  const duplicates = findDuplicateBookmarksBy(nodes, findby);
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

// When the select changes, clear results
elFindDuplicatesBySelect.addEventListener("change", () => {
  elFoundDuplicatesList.replaceChildren();
  elFindDuplicatesStatusLabel.innerText = "";
});

// When the checkbox for "Confirm Bookmark Deletion" is clicked.
elConfirmBookmarkDeletionCheckbox.addEventListener("click", (event) => {
  if (elConfirmBookmarkDeletionCheckbox.checked) {
    return;
  }
  event.preventDefault();
  const confirmationModal = createConfirmationModal({
    title: "Important",
    message:
      "Please note, this means you will not be asked to confirm bookmark deletion!!\n\nWe are not responsible for any bookmarks that you accidentally delete!\n\nAre you sure?",
    okButtonText: "Yes",
    closeButtonText: "No",
    onOkButtonClick: (ev) => {
      elConfirmBookmarkDeletionCheckbox.checked = false;
      confirmationModal.hide();
    },
    onCancelButtonClick: (ev) => {
      elConfirmBookmarkDeletionCheckbox.checked = true;
      confirmationModal.hide();
    },
  });
  confirmationModal.show();
});

/**
 * ==============================================================================================================================
 * FUNCTIONS
 * ==============================================================================================================================
 */

/**
 * Parses and sorts raw BookmarkTreeNode[] recursively.
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {SortNodesBy} sortBy
 */
function sortRawNodesRecursively(nodes, sortBy) {
  sortRawNodes(nodes, sortBy);
  for (const node of nodes) {
    if (node.children?.length) {
      sortRawNodesRecursively(node.children, sortBy);
    }
  }
}

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
 * @param {TargetType} findBy
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
 * Generaetes HTML for duplicate bookmarks.
 * @param {BookmarkTreeNodeExtended[]} nodes : an array of the duplicates
 * @param {TargetType} targetType : either "url" or "title"
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
 * @param {BookmarkTreeNodeExtended} node
 * @param {TargetType} targetType
 */
function generateDuplicateBookmarkDetailsHTML(node, targetType) {
  const duplicateListItem = document.createElement("li");
  const deleteButton = document.createElement("button");
  const deleteIcon = document.createElement("i");
  const editButton = document.createElement("button");
  const editIcon = document.createElement("i");
  const detailsList = document.createElement("ul");
  const targetTextListItem = document.createElement("li");
  const targetTextParagraph = document.createElement("p");
  const targetTextBold = document.createElement("b");
  const targetComplimentListItem = document.createElement("li");
  const targetComplimentParagraph = document.createElement("p");
  const targetComplimentBold = document.createElement("b");
  const bookmarkPathListItem = document.createElement("li");
  const bookmarkPathBold = document.createElement("b");
  const pathSuffix = document.createElement("p");

  duplicateListItem.classList.add("list-group-item", "d-flex", "flex-row", "align-items-center");
  duplicateListItem.id = `${node.id}-list-item`;

  deleteButton.classList.add("btn", "btn-danger", "btn-sm", "ms-1");
  deleteButton.disabled = !!node.unmodifiable;
  deleteButton.addEventListener("click", async () => {
    if (!elConfirmBookmarkDeletionCheckbox.checked) {
      try {
        return await browser.bookmarks.remove(node.id);
      } catch (e) {
        return console.error(`[BookmarkBurst][delete-duplicante-bookmark]`, e);
      }
    }

    const confirmationModal = createConfirmationModal({
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this bookmark?\n\nThis action cannot be undone!",
      okButtonText: "Yes",
      closeButtonText: "No",
      onCancelButtonClick: () => {
        confirmationModal.hide();
      },
      onOkButtonClick: async () => {
        try {
          // The handler for the resulting event will take care of rerendering tree.
          await browser.bookmarks.remove(node.id);
        } catch (e) {
          console.log("ERROR!", { error: e, node });
        } finally {
          confirmationModal.hide();
        }
      },
    });

    if (confirmationModal) {
      confirmationModal.show();
    }
  });

  deleteIcon.classList.add("bi", "bi-trash");

  deleteButton.appendChild(deleteIcon);

  editButton.classList.add("btn", "btn-primary", "ms-auto", "btn-sm");
  editButton.disabled = !!node.unmodifiable;
  editButton.addEventListener("click", () => {
    const editBookmarkModal = createEditBookmarkModal({
      url: node.url,
      title: node.title,
      id: node.id,
      targetType,
      onCancelButtonClick: () => {
        editBookmarkModal.hide();
      },
      onSaveButtonClick: async ({ setAlert, originalTitle, originalUrl, updatedUrl, updatedTitle }) => {
        try {
          // If any changes were made we need to update the bookmark, as well as our results that are being displayed.
          if (originalUrl !== updatedUrl || originalTitle !== updatedTitle) {
            await browser.bookmarks.update(node.id, { url: updatedUrl, title: updatedTitle });
            setAlert({ alertMessage: "Successfully edited bookmark!", alertType: "success" });
            // Rerun duplicate bookmark check to 'refresh' our duplicate results.
            // TODO: could prob just edit the HTML directly without having to rerun an expensive task.
            elFindDuplicatesButton.click();
          }
        } catch (e) {
          setAlert({ alertMessage: "Error! Something went wrong!", alertType: "danger" });
          console.error(`[BookmarkBlast][edit-bookmark-modal-save] Error saving bookmark!`, e);
        }
      },
    });

    if (editBookmarkModal) {
      editBookmarkModal.show();
    }
  });

  editIcon.classList.add("bi", "bi-pencil");

  editButton.appendChild(editIcon);

  detailsList.classList.add("list-group", "small");

  targetTextListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");

  targetTextParagraph.classList.add("text-start", "word-break-all", "mb-0");
  targetTextParagraph.id = `${node.id}-${targetType}`;
  targetTextParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.url : node.title}`;

  targetTextBold.innerText = targetType === "url" ? "URL: " : "Title: ";

  targetTextListItem.appendChild(targetTextBold);
  targetTextListItem.appendChild(targetTextParagraph);

  targetComplimentListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");

  targetComplimentParagraph.classList.add("text-start", "word-break-all", "mb-0");
  targetComplimentParagraph.id = `${node.id}-${targetType === "url" ? "title" : "url"}`;
  targetComplimentParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.title : node.url}`;

  targetComplimentBold.innerText = targetType === "url" ? "Title: " : "URL: ";

  targetComplimentListItem.appendChild(targetComplimentBold);
  targetComplimentListItem.appendChild(targetComplimentParagraph);

  bookmarkPathListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1");

  bookmarkPathBold.innerText = "Folder: ";

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

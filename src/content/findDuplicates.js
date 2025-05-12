/**
 * Documenting the attributes used within duplicate bookmarks "editing card"/bookmark details.
 *
 *  "data-bmb-title-for":
 *    So we can easily find the element that is displaying the title for "this" BookmarkTreeNode. The value of this attributes is the node ID.
 *
 *  "data-bmb-url-for":
 *    So we can easily find the element that is displaying the url for "this" BookmarkTreeNode. The value of this attributes is the node ID.
 *
 *  "data-bmb-path-for":
 *    So we can easily find the element that is displaying the path for "this" BookmarkTreeNode. The value of this attributes is the node ID.
 *
 *  "data-bmb-duplicate-for"
 *    The list group that holds each duplicates details. This is the details nested within the main card for "this" set of duplicates.
 *    The value of this attribute will either be the literal URL or Title.
 *    We use this to query for how many duplicate bookmarks there are.
 *
 *  "data-bmb-card-for"
 *    The main card that holds all of the details for each duplicate node. This is the overall container that lists each duplicate.
 *
 *  "data-bmb-card-title-for"
 *    The 'root' card title for this set of duplicates.
 */
import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

import { findAllBookmarks, sortRawNodes, BookmarkTreeNodeExtended } from "./utils.js";
import { createEditBookmarkModal } from "./components/editBookmarkModal.js";
import { createConfirmationModal } from "./components/confirmationModal.js";
import { createLoadingSpinner } from "./components/loadingSpinner.js";

/**
 * @typedef {"title" | "url"} TargetType
 * @typedef {"Folders First" | "Date Added Newest First" | "Date Added Newest Last" | "Alphabetical"} SortNodesBy
 */

const elFindDuplicatesButton = document.getElementById("start-find-duplicates");
const elFindDuplicatesBySelect = document.getElementById("find-duplicates-by");
const elFindDuplicatesStatusLabel = document.getElementById("number-of-duplicates-found");
const elFoundDuplicatesList = document.getElementById("duplicates-list");
const elConfirmBookmarkDeletionCheckbox = document.getElementById("confirm-delete-bookmark");

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

  if (!duplicateEntries.length) {
    elFindDuplicatesStatusLabel.innerText = `No duplicates found`;
    return;
  }

  elFindDuplicatesStatusLabel.innerText = `${duplicateEntries.length} duplicate${duplicateEntries.length > 1 ? "s" : ""} found`;
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
 *  Find duplicate bookmarks by specific TargetType
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
 * Generaetes HTML for duplicate bookmarks "review"/"edit"/"details" (whatever you want to call it) card.
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
  const cardBody = document.createElement("div");
  const cardTitle = document.createElement("div");
  const cardSubTitle = document.createElement("p");
  const duplicatesListContainer = document.createElement("div");
  const duplicatesList = document.createElement("ul");

  card.classList.add("card", "m-2");
  card.style.height = "320px";
  card.setAttribute("data-bmb-card-for", targetType === "title" ? nodes[0]?.title : nodes[0]?.url);

  cardBody.classList.add("card-body", "d-flex", "flex-column", "overflow-scroll");

  cardTitle.classList.add("card-title");

  cardSubTitle.classList.add("small", "mb-1");
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  cardSubTitle.innerText = `${nodes.length} Duplicate ${targetType === "url" ? "URL" : "Title"}s Found`;
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  cardSubTitle.setAttribute("data-bmb-card-title-for", targetType === "title" ? nodes[0]?.title : nodes[0]?.url);

  duplicatesListContainer.classList.add("flex-grow-1", "d-flex", "flex-column", "justify-content-center");

  duplicatesList.classList.add("list-group");
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  duplicatesList.setAttribute("data-bmb-duplicate-for", targetType === "title" ? nodes[0]?.title : nodes[0]?.url);

  duplicatesListContainer.appendChild(duplicatesList);
  cardTitle.appendChild(cardSubTitle);
  cardBody.appendChild(cardTitle);
  cardBody.appendChild(duplicatesListContainer);

  for (const node of nodes) {
    duplicatesList.appendChild(generateDuplicateBookmarkDetailsHTML(node, targetType));
  }

  card.appendChild(cardBody);
  return card;
}

/**
 * Generates the details view for a bookmark. Includes "title", "url", and "path", along with edit/delete buttons.
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

  deleteIcon.classList.add("bi", "bi-trash");

  deleteButton.appendChild(deleteIcon);

  editButton.classList.add("btn", "btn-primary", "ms-auto", "btn-sm");
  editButton.disabled = !!node.unmodifiable;

  editIcon.classList.add("bi", "bi-pencil");

  editButton.appendChild(editIcon);

  detailsList.classList.add("list-group", "small");

  targetTextListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetTextListItem.setAttribute(targetType === "url" ? "data-bmb-url-for" : "data-bmb-title-for", node.id);

  targetTextParagraph.classList.add("text-start", "word-break-all", "mb-0");
  targetTextParagraph.id = `${node.id}-${targetType}`;
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetTextParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.url : node.title}`;

  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetTextBold.innerText = targetType === "url" ? "URL: " : "Title: ";

  targetTextListItem.appendChild(targetTextBold);
  targetTextListItem.appendChild(targetTextParagraph);

  targetComplimentListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1", "d-flex", "flex-row");
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetComplimentListItem.setAttribute(targetType === "url" ? "data-bmb-title-for" : "data-bmb-url-for", node.id);

  targetComplimentParagraph.classList.add("text-start", "word-break-all", "mb-0");
  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetComplimentParagraph.id = `${node.id}-${targetType === "url" ? "title" : "url"}`;
  targetComplimentParagraph.innerText = `${String.fromCharCode(160)}${targetType === "url" ? node.title : node.url}`;

  // TODO : a lot of these ternary expressions can be include together, so we only have to check the type once...
  targetComplimentBold.innerText = targetType === "url" ? "Title: " : "URL: ";

  targetComplimentListItem.appendChild(targetComplimentBold);
  targetComplimentListItem.appendChild(targetComplimentParagraph);

  bookmarkPathListItem.classList.add("list-group-item", "me-2", "border-0", "pt-0", "pb-1");
  bookmarkPathListItem.setAttribute("data-bmb-path-for", node.id);

  bookmarkPathBold.innerText = "Folder: ";

  pathSuffix.classList.add("text-start", "word-break-all", "m-0");
  node.path.pop();
  pathSuffix.innerText = `${node.path.join(` ${String.fromCharCode(8594)} `)}`;

  /** Event Handlers */

  // Delete a bookmark.
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
          console.error("ERROR!", { error: e, node });
        } finally {
          confirmationModal.hide();
        }
      },
    });

    if (confirmationModal) {
      confirmationModal.show();
    } else {
      console.error(`[BookmarkBurst][manage][ERROR] Something went wrong while creating confirmation-modal within findDuplicates->Delete Bookmark!`);
    }
  });

  // Edit a bookmark
  editButton.addEventListener("click", () => {
    const editBookmarkModal = createEditBookmarkModal({
      url: node.url,
      title: node.title,
      onCancelButtonClick: () => {
        editBookmarkModal.hide();
      },
      onSaveButtonClick: async ({ setAlert, originalTitle, originalUrl, updatedUrl, updatedTitle }) => {
        // Neither title or url changed
        if (originalTitle === updatedTitle && originalUrl === updatedUrl) {
          return;
        }

        try {
          // We know something has changed so we can update the bookmark.
          await browser.bookmarks.update(node.id, { url: updatedUrl, title: updatedTitle });
          setAlert({ alertMessage: "Successfully edited bookmark!", alertType: "success" });

          // The remaining code in this block updates the DOM with our changes.. As opposed to just re-running the expensive
          // task of finding all duplicates from scratch, which would also render the duplicates.

          // Use a config object to help us stay D.R.Y.
          const targets = {
            url: {
              isChanged: originalUrl !== updatedUrl,
              nodesUListSelector: `[data-bmb-duplicate-for="${node.url}"]`,
              cardSelector: `[data-bmb-card-for="${node.url}"]`,
              cardTitleSelector: `[data-bmb-card-title-for="${originalUrl}"]`,
              updated: updatedUrl,
              label: "URL",
            },
            title: {
              isChanged: originalTitle !== updatedTitle,
              nodesUListSelector: `[data-bmb-duplicate-for="${node.title}"]`,
              cardSelector: `[data-bmb-card-for="${node.title}"]`,
              cardTitleSelector: `[data-bmb-card-title-for="${originalTitle}"]`,
              updated: updatedTitle,
              label: "Title",
            },
          };

          const target = targets[targetType];
          const opposite = targets[targetType === "title" ? "url" : "title"];

          // For example, if we are targeting by URL and the Title changed (or vice versa). AKA if the opposite of the target changed..
          if (opposite.isChanged) {
            // We need to modify the compliment element (aka the opposite of the target).
            targetComplimentParagraph.innerText = `${String.fromCharCode(160)}${opposite.updated}`;
          }
          // If the target isn't changed we can just return early
          if (!target.isChanged) {
            return;
          }

          // Get the element that is holding our duplicate bookmarks.
          const elNodesUList = document.querySelector(target.nodesUListSelector);
          // If there are only <=2 items, it means we can remove this as a duplicate altogether.
          if (elNodesUList && elNodesUList.childElementCount <= 2) {
            // Remove this entire "details" card.
            const card = document.querySelector(target.cardSelector);
            if (card) {
              // We need to get the parent of the card and remove it
              card.parentElement.remove();
              // Update main overall status label (at top of page) with count since we removed this set of duplicates.
              const numDuplicates = parseInt(elFindDuplicatesStatusLabel.innerText.split(" ")[0]) - 1;
              const pluralOrSingular = numDuplicates > 1 ? "duplicates" : "duplicate";
              elFindDuplicatesStatusLabel.innerText = `${numDuplicates} ${pluralOrSingular} found`;
            }
            // We can return here since there is no need to check for individual bookmarks (since we just removed the entire card).
            return;
          }

          // If we made it here it means there are still duplicates for this target-type even though we edited "this" bookmarks target-type.
          // For example, if we have 3 duplicates, all with the same Title (Title is the target-type), and only one of those titles was edited, we
          // still have 2 bookmarks with the same title. Meaning, duplicates still exist for that Title.
          // So we only need to remove "this" bookmark from being a duplicate, not the overall group of duplicates (since 2 still exist, given the example).
          duplicateListItem.remove();
          // Update the label within this card with new count.
          const elCardTitle = document.querySelector(target.cardTitleSelector);
          const numTargetDuplicates = parseInt(elCardTitle.innerText.split(" ")[0]) - 1;
          elCardTitle.innerText = `${numTargetDuplicates} Duplicate ${target.label}s Found`;
        } catch (e) {
          setAlert({ alertMessage: "Error! Something went wrong!", alertType: "danger" });
          console.error(`[BookmarkBlast][edit-bookmark-modal-save] Error saving bookmark!`, e);
        }
      },
    });

    if (editBookmarkModal) {
      editBookmarkModal.show();
    } else {
      console.error(`[BookmarkBurst][manage][ERROR] Something went wrong while creating edit-bookmark-modal! Within findDuplicates->Edit Bookmark`);
    }
  });

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

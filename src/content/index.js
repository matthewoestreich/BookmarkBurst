/** @type {Set<browser.Bookmarks.BookmarkTreeNode>} */
window.CHECKED_NODES = new Set();

function clearDuplicates() {
  const duplicatesList = document.getElementById("duplicates-list");
  if (duplicatesList) {
    duplicatesList.replaceChildren();
  }
  const duplicatesLabel = document.getElementById("number-of-duplicates-found");
  if (duplicatesLabel) {
    duplicatesLabel.innerText = "";
  }
}

function collapseAll() {
  const allExpandedUListElements = Array.from(document.querySelectorAll("ul[data-bmb-expanded='1']"));
  if (allExpandedUListElements.length) {
    for (const expandedEl of allExpandedUListElements) {
      expandedEl.classList.remove("show");
      expandedEl.setAttribute("data-bmb-expanded", 0);
    }
  }

  const allExpandedSpanIcons = Array.from(document.querySelectorAll("span[data-bmb-folder-icon-expanded='1']"));
  if (allExpandedSpanIcons.length) {
    for (const expandedSpan of allExpandedSpanIcons) {
      expandedSpan.setAttribute("data-bmb-folder-icon-expanded", 0);
    }
  }

  const allCheckedInputs = Array.from(document.querySelectorAll("input[data-bmb-checkbox='true'][checked='true']"));
  if (allCheckedInputs.length) {
    for (const checkedInput of allCheckedInputs) {
      checkedInput.checked = false;
    }
  }
  console.log(window.CHECKED_NODES.size);
  window.CHECKED_NODES.clear();
}

document.getElementById("menu-tab-manage-bookmarks")?.addEventListener("click", () => {
  clearDuplicates();
});

document.getElementById("menu-tab-detect-duplicates")?.addEventListener("click", () => {
  collapseAll();
});

document.getElementById("menu-tab-detect-dead-bookmarks")?.addEventListener("click", () => {
  clearDuplicates();
  collapseAll();
});

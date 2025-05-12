/**
 *
 * This file contains methods that are used within more than one other file.
 *
 */
import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";

/**
 * @typedef {"Folders First" | "Date Added Newest First" | "Date Added Newest Last" | "Alphabetical"} SortNodesBy
 * @typedef {"title" | "url"} SearchNodesBy
 */

/**
 * @implements {browser.Bookmarks.BookmarkTreeNode}
 */
export class BookmarkTreeNodeExtended {
  path = [];

  /**
   * BookmarkNode is our internal symbolic representation of the builtin type  `bookmarks.BookmarkTreeNode`.
   * @param {browser.Bookmarks.BookmarkTreeNode} node
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
 * Recursively finds all bookmarks.
 * @param {browser.Bookmarks.BookmarkTreeNode[] | BookmarkTreeNodeExtended[]} nodes
 * @param {string[]} currentPath : typically not to be used by caller, we use it to track current path.
 * @returns {BookmarkTreeNodeExtended[]}
 */
export function findAllBookmarks(nodes, currentPath = []) {
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
 * Parses and sorts raw BookmarkTreeNode[]
 * @param {browser.Bookmarks.BookmarkTreeNode[]} nodes
 * @param {SortNodesBy} sortBy
 */
export function sortRawNodes(nodes, sortBy) {
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
    case "Date Added Newest First": {
      nodes.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      break;
    }
    case "Date Added Newest Last": {
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

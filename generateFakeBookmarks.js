import nodepath from "node:path";
import nodefs from "node:fs";
import { faker } from "@faker-js/faker";

createFakeBookmarksFile(100, ".");

function newFakeBookmarkFile(bookmarks) {
  let bookmarksStr = "";
  bookmarks.forEach((b) => (bookmarksStr += `\t\t\t\t\t\t${b}\n`));

  return `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'none'; img-src data: *; object-src 'none'"></meta>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>

<DL><p>
    <DT><H3 ADD_DATE="1746027888" LAST_MODIFIED="1746465671">BookmarkBurst</H3>
        <DL><p>
${bookmarksStr}
        </DL><p>
</DL>
`;
}

function newFakeBookmark(url, dateAdded, dateModified, title) {
  return `<DT><A HREF="${url}" ADD_DATE="${dateAdded}" LAST_MODIFIED="${dateModified}">${title}</A>`;
}

function createFakeBookmarksFile(numberOfBookmarks = 10, savePathWithoutFileName) {
  const duplicateUrlsPool = [];
  const duplicateTitlesPool = [];
  for (let i = 0; i < Math.floor(numberOfBookmarks / 3); i++) {
    duplicateUrlsPool.push(`https://${faker.internet.domainName()}`);
    const title = faker.word.words({ count: { min: 1, max: 5 } });
    duplicateTitlesPool.push(title.trim());
  }

  const fakeBookmarks = [];

  for (let i = 0; i < numberOfBookmarks; i++) {
    if (i % 3 === 0) {
      if (duplicateTitlesPool.length && duplicateUrlsPool.length) {
        const duplicateUrl = duplicateUrlsPool.pop();
        const duplicateTitle = duplicateTitlesPool.pop();
        const amountOfDuplicats = Math.floor(Math.random() * 5);

        // Generate duplicate URLs
        for (let j = 0; j < amountOfDuplicats; j++) {
          const dateAdded = faker.date.between({ from: "2020-01-01", to: Date.now() });
          const dateModified = faker.date.between({ from: dateAdded, to: Date.now() });
          const title = faker.word.words({ count: { min: 1, max: 5 } });
          fakeBookmarks.push(newFakeBookmark(duplicateUrl, dateAdded.getTime(), dateModified.getTime(), title.trim()));
        }
        // Generate duplicate titles
        for (let k = 0; k < amountOfDuplicats; k++) {
          const dateAdded = faker.date.between({ from: "2020-01-01", to: Date.now() });
          const dateModified = faker.date.between({ from: dateAdded, to: Date.now() });
          fakeBookmarks.push(newFakeBookmark(`https://${faker.internet.domainName()}`, dateAdded.getTime(), dateModified.getTime(), duplicateTitle));
        }
      }
      continue;
    }

    const domain = faker.internet.domainName();
    const url = `https://${domain}`;
    const dateAdded = faker.date.between({ from: "2020-01-01", to: Date.now() });
    const dateModified = faker.date.between({ from: dateAdded, to: Date.now() });
    const title = faker.word.words({ count: { min: 1, max: 5 } });
    const bookmark = newFakeBookmark(url, dateAdded.getTime(), dateModified.getTime(), title);
    fakeBookmarks.push(bookmark);
  }

  const now = new Date();
  const filename = `fake_bookmarks_${now.getMonth()}_${now.getDate()}_${now.getFullYear()}_${now.getTime()}.html`;
  const file = newFakeBookmarkFile(fakeBookmarks);
  const path = nodepath.resolve(import.meta.dirname, savePathWithoutFileName, filename);
  nodefs.writeFileSync(path, file, "utf-8");
}

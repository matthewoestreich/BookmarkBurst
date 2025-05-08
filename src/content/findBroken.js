import browser from "webextension-polyfill";
import * as bootstrap from "bootstrap";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

import { createProgressBar } from "./components/progressBar";

const elFindBrokenBookmarksButton = document.getElementById("start-detect-dead-bookmarks");
const elFindBrokenBookmarksTimeoutSelect = document.getElementById("find-dead-bookmarks-timeout");

elFindBrokenBookmarksButton.addEventListener("click", async () => {});

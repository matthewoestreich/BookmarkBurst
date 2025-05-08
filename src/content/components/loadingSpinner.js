import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "../index.css";

/**
 * Creates HTML for loading spinner
 * @param {string} id
 * @returns {HTMLDivElement}
 */
export function createLoadingSpinner(id = null) {
  const container = document.createElement("div");
  const div = document.createElement("div");
  const span = document.createElement("span");

  container.classList.add("d-flex", "flex-row", "justify-content-center");
  if (id) {
    container.id = id;
  }

  div.classList.add("spinner-border", "text-primary");
  div.setAttribute("role", "status");

  span.classList.add("visually-hidden");
  span.innerText = "Loading...";

  div.appendChild(span);
  container.appendChild(div);
  return container;
}

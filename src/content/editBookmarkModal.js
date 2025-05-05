import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "./index.css";

const elEditBookmarkModal = document.getElementById("modal-edit-bookmark");
const elEditBookmarkModalBookmarkData = document.getElementById("bookmark-data");
const elEditBookmarkModalAlertMessage = document.getElementById("modal-edit-bookmark-alert");
const elEditBookmarkModalSaveButton = document.getElementById("modal-edit-bookmark-save-button");
const elEditBookmarkModalCancelButton = document.getElementById("modal-edit-bookmark-close-button");
const elEditBookmarkModalUrlInput = document.getElementById("modal-edit-bookmark-url");
const elEditBookmarkModalTitleInput = document.getElementById("modal-edit-bookmark-title");

/**
 *  @typedef {"danger" | "success"} AlertType
 * @typedef {{ alertType: AlertType, alertMessage: string }} SetAlertProperties
 *
 * @typedef {{
 *  event: MouseEvent,
 *  originalTitle: string;
 *  originalUrl: string;
 *  updatedUrl: string;
 *  updatedTitle: string;
 *  setAlert: (props: SetAlertProperties);
 * }} EditBookmarkModalCallbackProperties
 *
 * @typedef {{
 *  title: string;
 *  url: string;
 *  id: string;
 *  targetType: "url" | "title";
 *  onSaveButtonClick: (callbackProps: EditBookmarkModalCallbackProperties) => any;
 *  onCancelButtonClick?: (callbackProps: EditBookmarkModalCallbackProperties) => any;
 * }} CreateEditBookmarkModalProperties
 */

function clearModalData() {
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-id", "");
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-target-field", "");
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-url", "");
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-title", "");
  elEditBookmarkModalUrlInput.value = "";
  elEditBookmarkModalTitleInput.value = "";
  elEditBookmarkModalAlertMessage.setAttribute("class", "");
  elEditBookmarkModalAlertMessage.innerText = "";
}

/**
 * Create an edit bookmark modal.
 * @param {CreateEditBookmarkModalProperties} props
 */
export function createEditBookmarkModal(props) {
  const { title, url, id, targetType, onSaveButtonClick, onCancelButtonClick } = props;

  const bootstrapModalInstance = bootstrap.Modal.getOrCreateInstance(elEditBookmarkModal);
  const originalTitle = title;
  const originalUrl = url;

  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-url", url);
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-title", title);
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-id", id);
  elEditBookmarkModalBookmarkData.setAttribute("data-bookmark-target-field", targetType);
  elEditBookmarkModalUrlInput.value = url || "";
  elEditBookmarkModalTitleInput.value = title || "";

  /**
   * @param {SetAlertProperties} props
   */
  function setAlert(props) {
    elEditBookmarkModalAlertMessage.classList.add(`alert-${props.alertType}`);
    elEditBookmarkModalAlertMessage.innerText = props.alertMessage;
  }

  // On Ok button click handler
  function handleOk(event) {
    const updatedUrl = elEditBookmarkModalUrlInput.value;
    const updatedTitle = elEditBookmarkModalTitleInput.value;
    onSaveButtonClick({ event, originalTitle, originalUrl, updatedUrl, updatedTitle, setAlert });
  }

  // On Cancel button click handler
  function handleCancel(event) {
    const updatedUrl = elEditBookmarkModalUrlInput.value;
    const updatedTitle = elEditBookmarkModalTitleInput.value;
    if (onCancelButtonClick) {
      onCancelButtonClick({ event, originalTitle, originalUrl, updatedUrl, updatedTitle, setAlert });
    }
    clearModalData();
  }

  elEditBookmarkModalSaveButton.addEventListener("click", handleOk, { once: true });
  elEditBookmarkModalCancelButton.addEventListener("click", handleCancel, { once: true });

  // Cleanup handlers when modal is hidden
  elEditBookmarkModal.addEventListener("hidden.bs.modal", () => {
    elEditBookmarkModalSaveButton.removeEventListener("click", handleOk);
    elEditBookmarkModalCancelButton.removeEventListener("click", handleCancel);
  });

  return bootstrapModalInstance;
}

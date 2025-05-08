import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff";
import "bootstrap-icons/font/fonts/bootstrap-icons.woff2";
import "../index.css";

/**
 * @typedef {{
 *  title: string;
 *  message: string;
 *  okButtonText: string;
 *  closeButtonText: string;
 *  onOkButtonClick: (ev: MouseEvent) => any;
 *  onCancelButtonClick?: (ev: MouseEvent) => any;
 * }} CreateConfirmationModalProperties
 */

const elModalConfirm = document.getElementById("modal-confirm");
const elModalConfirmTitle = document.getElementById("modal-confirm-title");
const elModalConfirmMessage = document.getElementById("modal-confirm-message");
const elModalConfirmCloseButton = document.getElementById("modal-confirm-close-button");
const elModalConfirmOkButton = document.getElementById("modal-confirm-ok-button");

/**
 * Lets you configure a confirmation dialog and returns a `bootstrap.Modal` instance.
 * @param {CreateConfirmationModalProperties} props
 * @returns {bootstrap.Modal}
 */
export function createConfirmationModal({ title, okButtonText, closeButtonText, message, onOkButtonClick, onCancelButtonClick }) {
  if (!elModalConfirm || !elModalConfirmTitle || !elModalConfirmMessage || !elModalConfirmCloseButton || !elModalConfirmOkButton) {
    return null;
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(elModalConfirm);

  elModalConfirmTitle.innerText = title;
  elModalConfirmOkButton.innerText = okButtonText;
  elModalConfirmCloseButton.innerText = closeButtonText;
  elModalConfirmMessage.innerText = message;

  // On Ok button click handler
  function handleOk(e) {
    onOkButtonClick(e);
  }

  // On Cancel button click handler
  function handleClose(e) {
    if (onCancelButtonClick) {
      onCancelButtonClick(e);
    }
  }

  elModalConfirmOkButton.addEventListener("click", handleOk, { once: true });
  elModalConfirmCloseButton.addEventListener("click", handleClose, { once: true });

  // Cleanup handlers when modal is hidden
  // This is extremely necessary!! Otherwise the modal will "hold onto" previous handlers
  // which will cause unexpected behavior.
  // For example:
  //  - If you click delete on a duplicate, you get this confirmation modal.
  //  - If you "No" on that modal it will close..
  //  - If you then uncheck "Confirm Bookmark Deletion" you get a confirmation modal.
  //  - If you click "Yes" on that, if we didn't remove prior event handlers, the bookmark you chose
  //    to not delete would then be deleted (since it's event handler still existed).
  // This is why it is crucial to cleanup handlers!
  elModalConfirm.addEventListener("hidden.bs.modal", () => {
    elModalConfirmOkButton.removeEventListener("click", handleOk);
    elModalConfirmCloseButton.removeEventListener("click", handleClose);
  });

  return bsModal;
}

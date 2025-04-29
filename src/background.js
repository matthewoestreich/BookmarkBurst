import browser from "webextension-polyfill";

class BookmarkBurst {
  events = {};

  constructor() {
    browser.runtime.onMessage.addListener(this.#handleMessage);
  }

  /**
   * MUST BE AN ARROW FUNCTION OR ELSE `this` WILL BE UNDEFINED
   * @param {RuntimeMessage} message
   * @param {typeof browser.runtime.MessageSender} sender
   * @param {typeof browser.runtime.sendMessage} sendResponse
   * @returns
   */
  #handleMessage = (message, sender, sendResponse) => {
    if (!message.event) {
      return false;
    }
    const eventName = message.event;
    if (!this.events[eventName]) {
      return false;
    }
    for (const handler of this.events[eventName]) {
      handler(message, sender, sendResponse);
    }

    // Required to keep the message channel open so we can have async handlers.
    return true;
  };

  /**
   * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/onClicked
   * @param {(tab: browser.tabs.Tab, info?: browser.action.OnClickData) => void} handler
   */
  onActionClick(handler) {
    browser.action.onClicked.addListener(handler);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/onAdded
   * @param {(permissions: browser.permissions.Permissions) => void} handler
   */
  onPermissionsGranted(handler) {
    browser.permissions.onAdded.addListener(handler);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/onRemoved
   * @param {(permissions: browser.permissions.Permissions) => void} handler
   */
  onPermissionsRemoved(handler) {
    browser.permissions.onRemoved.addListener(handler);
  }

  /**
   *
   * @param {string} eventName
   * @param {(message: any, sender: browser.runtime.MessageSender, sendResponse: (response?: any) => void) => Promise<void>} eventHandler
   */
  onMessage(eventName, eventHandler) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(eventHandler);
  }

  // Remove message handler
  offMessage(eventName, eventHandler) {
    if (!this.events[eventName]) {
      return;
    }
    const index = this.events[eventName].findIndex((handler) => handler === eventHandler);
    if (!index || index === -1) {
      return;
    }
    this.events[eventName].splice(index, 1);
  }

  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendMessage
  async sendMessage(message = {}, extensionId = null, options = null) {
    if (extensionId && options) {
      return browser.runtime.sendMessage(extensionId, message, options);
    }
    if (extensionId && !options) {
      return browser.runtime.sendMessage(extensionId, message);
    }
    if (!extensionId && options) {
      return browser.runtime.sendMessage(message, options);
    }
    return browser.runtime.sendMessage(message);
  }

  async testUrl(url, timeoutMs) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || response.status !== 200) {
        return false;
      }
      return true;
    } catch (e) {
      console.error(`[BookmarkBlas][background][testUrl]`, e);
      clearTimeout(timeoutId);
      return false;
    }
  }
}

const bookmarkBurst = new BookmarkBurst();

bookmarkBurst.onActionClick(() => {
  const url = browser.runtime.getURL("index.html");
  browser.tabs.create({ url });
});

bookmarkBurst.onPermissionsGranted((permissions) => {
  console.log(`Permissions granted!`, { permissions });
});

bookmarkBurst.onPermissionsRemoved((permissions) => {
  console.warn(`Permissions removed!`, { permissions });
});

bookmarkBurst.onMessage("detect-dead-bookmarks", async (msg, sender, response) => {
  const { bookmarks, timeout } = msg;
  console.log({ bookmarks });
  for (const bmark of bookmarks) {
  }

  response(true);
});

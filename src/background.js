const api = typeof browser === "undefined" ? chrome : browser;

api.action.onClicked.addListener(() => {
	const popupUrl = api.runtime.getURL("index.html");
	api.tabs.create({ url: popupUrl });
});

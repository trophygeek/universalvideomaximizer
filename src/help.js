/**
 * Localize the page by processing all data-i18n attributes
 */
const localizePage = () => {
  // Set lang attribute dynamically based on Chrome locale
  document.documentElement.lang = chrome.i18n.getUILanguage();

  // Set page title
  const titleElement = document.getElementById("pageTitle");
  if (titleElement) {
    titleElement.textContent = chrome.i18n.getMessage("helpTitle");
  }

  // Process all elements with data-i18n attributes
  const elements = document.querySelectorAll("[data-i18n]");
  for (const element of elements) {
    const messageKey = element.getAttribute("data-i18n");
    if (messageKey) {
      const message = chrome.i18n.getMessage(messageKey);
      if (message) {
        // If message contains HTML tags, use innerHTML, otherwise textContent
        if (message.includes("<") && message.includes(">")) {
          element.innerHTML = message;
        } else {
          element.textContent = message;
        }
      }
    }
  }
};

// Localize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", localizePage);
} else {
  localizePage();
}



(function () {
  console.log("accept-cookies: overriding attachShadow");
  const acceptCookiesOrigAttachShadow = Element.prototype.attachShadow;
  let shadowEvents = [];
  let seenContentScript = false;
  window.addEventListener("acceptCookiesReady", () => {
    console.log("accept-cookies: saw ready event");
    seenContentScript = true;
    shadowEvents.forEach((e) => document.dispatchEvent(e));
    shadowEvents = [];
  });
  Element.prototype.attachShadow = function (options = {}) {
    options.mode = "open";
    const shadowDom = acceptCookiesOrigAttachShadow.call(this, options);
    let selector = this.nodeName.toLowerCase();
    if (this.id) {
      selector += "#" + this.id;
    } else if (this.className) {
      selector += "." + this.className.trim().replace(/\s+/g, ".");
    }
    const attachShadow = new CustomEvent("acceptCookiesAttachShadow", {
      detail: selector,
    });
    if (seenContentScript) {
      document.dispatchEvent(attachShadow);
    } else {
      shadowEvents.push(attachShadow);
    }
    return shadowDom;
  };
})();

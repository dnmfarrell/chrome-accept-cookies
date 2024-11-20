if (typeof acceptCookiesOrigAttachShadow === 'undefined') {
  var acceptCookiesOrigAttachShadow = Element.prototype.attachShadow;
}
Element.prototype.attachShadow = function (options = {}) {
  const element = this;
  try {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += '#' + element.id;
    } else if (element.className) {
      selector += '.' + element.className.trim().replace(/\s+/g, '.');
    }
    setTimeout(() => {
      const attachShadow = new CustomEvent('attachShadow', { detail: selector });
      document.dispatchEvent(attachShadow);
    }, 500);
    options.mode = "open";
    return acceptCookiesOrigAttachShadow.call(element, options);
  } catch (e) {
    console.log('caught error:', e);
  }
};

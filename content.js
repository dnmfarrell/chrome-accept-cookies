const cachedNodes = new Set();
const searchTimeout = 60000;
const batchSize = 50;
const batchTimeout = 50;
let distancePairs = [];
let searchNodes = [];
let cookieNodes = [];
let clickQueue = [];
let observers = [];
let buttonSet = new Set();
let watchedNodes = new Set();
let halt = false;

function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function nodeMentionsCookie(node) {
  if (halt) {
    return;
  }
  const allElements = node.querySelectorAll("*:not(script)");
  for (let e of allElements) {
    if (halt) {
      break;
    }
    if (e.textContent.toLowerCase().includes("cookie") && !cachedNodes.has(e)) {
      cookieNodes.push({ node: node, mentionsCookie: e });
      cachedNodes.add(e);
    }
    if (e.shadowRoot) {
      searchNodes.push(e.shadowRoot);
    }
  }
}

function findAcceptButtons(node) {
  if (halt) {
    return;
  }
  const buttons = [];
  const bs = node.querySelectorAll('button, [role="button"]');
  for (let b of bs) {
    if (halt) {
      break;
    }
    if (looksLikeAccept(b)) {
      buttons.push(b);
    }
  }
  return buttons;
}

const acceptPattern =
  /^ *((accept|allow)( +all)?( +cookies)?|(i +)?agree|(accept|agree) +(&|and) +continue) *$/im;

function looksLikeAccept(button) {
  const text = button.textContent;
  return acceptPattern.test(text);
}

function commonAncestorDistances(root, e, es) {
  if (halt) {
    return;
  }
  const distances = [];
  const leftAncestors = path(root, e);
  if (leftAncestors.length == 0) {
    // not in DOM
    return;
  }
  for (let e1 of es) {
    if (halt) {
      break;
    }
    let d = commonAncestorDistance(leftAncestors, e, e1);
    if (d > -1) {
      // not in DOM
      distancePairs.push({ element: e1, distance: d });
    }
  }
}

function commonAncestorDistance(path, e, e1) {
  let currentNode = e1;
  let distance = 0;
  while (true) {
    let pe = currentNode.parentNode;
    if (pe == null) {
      // not in DOM
      return -1;
    }
    const index = path.indexOf(pe);
    if (index > -1) {
      return distance + index;
    }
    distance++;
    currentNode = pe;
  }
  return distance;
}

function path(root, e) {
  const path = [e];
  let currentNode = e;
  while (true) {
    let pe = currentNode.parentNode;
    if (pe == root) {
      path.push(root);
      break;
    } else if (pe == null) {
      // not in DOM
      return [];
    }
    path.push(currentNode);
    currentNode = pe;
  }
  return path;
}

async function search() {
  if (halt) {
    return;
  }
  for (let i = 0; i < searchNodes.length; i++) {
    nodeMentionsCookie(searchNodes[i]);
    if (i % batchSize === 0) {
      await yieldToMain();
    }
  }
  searchNodes = [];
  for (let i = 0; i < cookieNodes.length; i++) {
    const m = cookieNodes[i];
    buttons = findAcceptButtons(m.node);
    commonAncestorDistances(m.node, m.mentionsCookie, buttons);
    if (i % batchSize === 0) {
      await yieldToMain();
    }
  }
  cookieNodes = [];
  distancePairs.sort((a, b) => a.distance - b.distance);
  for (let p of distancePairs) {
    if (!buttonSet.has(p.element)) {
      buttonSet.add(p.element);
      p.clicks = 0;
      clickQueue.push(p);
    }
  }
  clickQueue.sort((a, b) => a.distance - b.distance);
  distancePairs = [];
}

async function click() {
  if (clickQueue.length === 0) {
    return;
  }
  const clickTarget = clickQueue[0];
  if (!clickTarget.element.parentNode) {
    console.log("accept-cookies: button has disappeared, halting");
    halt = true;
    return;
  }
  if (clickTarget.clicks < 3) {
    console.log(
      "accept-cookies: clicking",
      clickTarget.clicks,
      clickTarget.element,
    );
    clickTarget.clicks++;
    clickTarget.element.click();
    return;
  } else {
    clickQueue.shift();
    return click();
  }
}

function checkMutation(mutationsList, observer) {
  if (halt) {
    observer.disconnect();
    return;
  }
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((n) => {
        if (n instanceof Element && n.tagName !== "SCRIPT") {
          searchNodes.push(n);
          if (n.shadowRoot) {
            observe(n.shadowRoot);
            searchNodes.push(n.shadowRoot);
          }
        }
      });
    }
  }
}

function observe(targetNode) {
  if (watchedNodes.has(targetNode)) {
    return;
  }
  const observer = new MutationObserver(checkMutation);
  const observerOptions = {
    childList: true,
    subtree: true,
  };
  observer.observe(targetNode, observerOptions);
  observers.push(observer);
  watchedNodes.add(targetNode);
}

function main() {
  console.log("accept-cookies: starting");
  document.addEventListener("acceptCookiesAttachShadow", (e) => {
    try {
      const nodes = document.body.querySelectorAll(e.detail);
      nodes.forEach((element) => {
        if (element.shadowRoot) {
          observe(element.shadowRoot);
          searchNodes.push(element.shadowRoot);
        }
      });
    } catch (e) {
      console.log("accept-cookies: caught error querying shadowDOM", e);
    }
  });
  window.dispatchEvent(new CustomEvent("acceptCookiesReady"));
  const targetNode = document.body;
  observe(targetNode);
  const timeout = () => {
    console.log("accept-cookies: timeout");
    halt = true;
    observers.forEach((o) => o.disconnect());
  };
  setTimeout(timeout, searchTimeout);
  searchNodes.push(targetNode);
  const keepSearching = async () => {
    if (halt) {
      return;
    }
    await search();
    click();
    setTimeout(keepSearching, batchTimeout);
  };
  keepSearching();
}
addEventListener("DOMContentLoaded", (e) => main());

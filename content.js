const cachedNodes = new Set();
const searchTimeout = 60000;
const batchSize     = 100;
const batchTimeout  = 50;
let distancePairs = [];
let searchNodes   = [];
let cookieNodes   = [];
let observers     = [];
let buttonSet     = new Set();
let watchedNodes  = new Set();
let halt          = false;
let minDistance   = -1;

function yieldToMain () {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

function nodeMentionsCookie(node) {
  if (halt) {
    return;
  }
  const allElements = node.querySelectorAll('*:not(script)');
  for (let e of allElements) {
    if (halt) {
      break;
    }
    if (e.textContent.toLowerCase().includes("cookie") && !cachedNodes.has(e)) {
      cookieNodes.push({ node:node, mentionsCookie:e });
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

const acceptPattern = /^ *((accept|allow)( +all)?( +cookies)?|(i +)?agree|(accept|agree) +(&|and) +continue) *$/im;

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
  if (leftAncestors.length == 0) { // not in DOM
    return;
  }
  for (let e1 of es) {
    if (halt) {
      break;
    }
    let d = commonAncestorDistance(leftAncestors, e, e1);
    if (d > -1) { // not in DOM
      distancePairs.push({element:e1,distance:d});
    }
  }
}

function commonAncestorDistance(path, e, e1) {
  let currentNode = e1;
  let distance = 0;
  while (true) {
    let pe = currentNode.parentNode;
    if (pe == null) { // not in DOM
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
    } else if (pe == null) { // not in DOM
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
  distancePairs.sort((a,b) => a.distance - b.distance);
  for (let p of distancePairs) {
    if (minDistance == -1 && p.element.parentNode) { // still in DOM
      minDistance = p.distance;
    } else if (minDistance < p.distance) {
      break;
    }
    buttonSet.add(p.element);
  }
  distancePairs = [];
  while (buttonSet.size > 0) {
    const b = buttonSet.values().next().value;
    buttonSet.delete(b);
    if (b.parentNode) { // still in DOM
      console.log("accept-cookies: clicking", b);
      b.click();
      break;
    }
  }
}

function checkMutation(mutationsList, observer) {
    if (halt) {
      observer.disconnect();
      return;
    }
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(n => {
          if (n instanceof Element && n.tagName !== 'SCRIPT') {
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
        subtree: true
      };
  observer.observe(targetNode, observerOptions);
  observers.push(observer);
  watchedNodes.add(targetNode);
}

function main() {
  console.log('accept-cookies: starting');
  document.addEventListener("acceptCookiesAttachShadow", (e) => {
    const nodes = document.body.querySelectorAll(e.detail);
    nodes.forEach(element => {
      if (element.shadowRoot) {
        observe(element.shadowRoot);
        searchNodes.push(element.shadowRoot);
      }
    });
  });
  window.dispatchEvent(new CustomEvent('acceptCookiesReady'));
  const targetNode = document.body;
  observe(targetNode);
  const timeout = () => {
    console.log('accept-cookies: timeout');
    halt = true;
    observers.forEach(o => o.disconnect());
  };
  setTimeout(timeout, searchTimeout);
  searchNodes.push(targetNode);
  const keepSearching = async () => {
    if (halt) {
      return;
    }
    await search();
    setTimeout(keepSearching,batchTimeout);
  };
  keepSearching();
}
addEventListener("DOMContentLoaded", (e) => main());

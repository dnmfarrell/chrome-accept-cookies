const cachedNodes = new Set();
let distancePairs = [];
let searchNodes   = [];
let cookieNodes   = [];
let watchedNodes  = new Set();
let observers     = [];
let buttonSet     = new Set();
let halt          = false;

addEventListener("DOMContentLoaded", (e) => main());
document.addEventListener("attachShadow", (e) => {
  const nodes = document.body.querySelectorAll(e.detail);
  nodes.forEach(element => {
    if (element.shadowRoot) {
      observe(element.shadowRoot);
      searchNodes.push(element.shadowRoot);
    }
  });
});

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
      nodeMentionsCookie(e.shadowRoot);
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

function looksLikeAccept(button) {
  const text = button.textContent.toLowerCase();
  const aria = button.ariaLabel?.toLowerCase() ?? '';
  return text.includes("accept")
         || text.includes("allow")
         || text.includes("agree")
         || aria.includes("accept")
         || aria.includes("allow")
         || aria.includes("agree")
  ;
}

function commonAncestorDistances(root, e, es) {
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
  // console.log('Searching nodes: ', searchNodes);
  searchNodes.forEach(n => {
    nodeMentionsCookie(n);
  });
  searchNodes = [];
  // console.log('Nodes mentioning cookies: ', cookieNodes);
  cookieNodes.forEach(m => {
    buttons = findAcceptButtons(m.node);
    commonAncestorDistances(m.node, m.mentionsCookie, buttons);
  });
  cookieNodes = [];
  distancePairs.sort((a,b) => a.distance - b.distance);
  // console.log('distancePairs', distancePairs);
  let minDistance = -1;
  for (let p of distancePairs) {
    if (minDistance == -1 && p.element.parentNode) { // still in DOM
      minDistance = p.distance;
    } else if (minDistance < p.distance) {
      break;
    }
    buttonSet.add(p.element);
  }
  distancePairs = [];
  // console.log('buttons:', buttonSet);
  for (let b of buttonSet) {
    if (b.parentNode) { // still in DOM
      // console.log('clicking cookie policy button:', b);
      b.click();
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
  // console.log("looking for cookie policy windows");
  const targetNode = document.body;
  observe(targetNode);
  const timeout = () => {
    halt = true;
    observers.forEach(o => o.disconnect());
    // console.log('timing out search');
  };
  searchNodes.push(targetNode);
  setTimeout(timeout, 60000);
  const keepSearching = () => {
    if (halt) {
      return;
    }
    search();
    setTimeout(keepSearching,2000);
  };
  keepSearching();
}

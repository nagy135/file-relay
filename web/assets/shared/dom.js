export const $ = (selector) => document.querySelector(selector);

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createToast() {
  let timer;
  return (message) => {
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 3000);
  };
}

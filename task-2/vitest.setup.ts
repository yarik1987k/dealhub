import "@testing-library/jest-dom/vitest";

// jsdom has no layout engine, so scrollIntoView is not implemented.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
beforeEach(() => {
  // Database tests run in plain Node, without a document.
  if (typeof window === "undefined") return;
  localStorage.clear();
  document.documentElement.removeAttribute("data-lite");
  window.scrollTo = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(cleanup);

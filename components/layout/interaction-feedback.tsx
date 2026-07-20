"use client";

import { useEffect } from "react";

const interactiveSelector = [
  "button",
  "a[href]",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "label",
  "summary",
  "[role='button']",
  "[role='link']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const workingClassName = "interaction-working";
const workingTimeoutMs = 15000;

function isDisabledElement(element: HTMLElement) {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

function setWorkingState(element: HTMLElement) {
  if (isDisabledElement(element)) return;

  element.classList.add(workingClassName);
  element.setAttribute("aria-busy", "true");

  window.setTimeout(() => {
    element.classList.remove(workingClassName);

    if (element.getAttribute("aria-busy") === "true") {
      element.removeAttribute("aria-busy");
    }
  }, workingTimeoutMs);
}

function isInternalNavigationLink(link: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;

  const href = link.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (/^(mailto|tel):/i.test(href)) return false;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const currentUrl = new URL(window.location.href);
  return url.pathname !== currentUrl.pathname || url.search !== currentUrl.search;
}

export function InteractionFeedback() {
  useEffect(() => {
    function acknowledgeInteraction(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactiveElement = target.closest(interactiveSelector);
      if (!(interactiveElement instanceof HTMLElement)) return;
      if (isDisabledElement(interactiveElement)) return;

      interactiveElement.classList.remove("interaction-acknowledged");
      window.requestAnimationFrame(() => {
        interactiveElement.classList.add("interaction-acknowledged");
        window.setTimeout(() => {
          interactiveElement.classList.remove("interaction-acknowledged");
        }, 650);
      });
    }

    function markSubmittedAction(event: SubmitEvent) {
      const submitter = event.submitter;
      if (!(submitter instanceof HTMLElement)) return;
      if (!submitter.classList.contains("btn")) return;

      setWorkingState(submitter);
    }

    function markNavigationAction(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href].btn");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigationLink(link, event)) return;

      window.setTimeout(() => {
        setWorkingState(link);
      }, 0);
    }

    function clearWorkingStates() {
      document.querySelectorAll(`.${workingClassName}`).forEach((element) => {
        element.classList.remove(workingClassName);

        if (element.getAttribute("aria-busy") === "true") {
          element.removeAttribute("aria-busy");
        }
      });
    }

    document.addEventListener("pointerdown", acknowledgeInteraction, {
      capture: true,
    });
    document.addEventListener("submit", markSubmittedAction, {
      capture: true,
    });
    document.addEventListener("click", markNavigationAction);
    window.addEventListener("pageshow", clearWorkingStates);

    return () => {
      document.removeEventListener("pointerdown", acknowledgeInteraction, {
        capture: true,
      });
      document.removeEventListener("submit", markSubmittedAction, {
        capture: true,
      });
      document.removeEventListener("click", markNavigationAction);
      window.removeEventListener("pageshow", clearWorkingStates);
    };
  }, []);

  return null;
}

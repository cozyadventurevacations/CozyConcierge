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

export function InteractionFeedback() {
  useEffect(() => {
    function acknowledgeInteraction(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactiveElement = target.closest(interactiveSelector);
      if (!(interactiveElement instanceof HTMLElement)) return;
      if (interactiveElement.hasAttribute("disabled")) return;
      if (interactiveElement.getAttribute("aria-disabled") === "true") return;

      interactiveElement.classList.remove("interaction-acknowledged");
      window.requestAnimationFrame(() => {
        interactiveElement.classList.add("interaction-acknowledged");
        window.setTimeout(() => {
          interactiveElement.classList.remove("interaction-acknowledged");
        }, 650);
      });
    }

    document.addEventListener("pointerdown", acknowledgeInteraction, {
      capture: true,
    });

    return () => {
      document.removeEventListener("pointerdown", acknowledgeInteraction, {
        capture: true,
      });
    };
  }, []);

  return null;
}

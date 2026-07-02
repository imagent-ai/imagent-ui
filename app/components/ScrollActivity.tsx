"use client";

import { useEffect } from "react";

const ACTIVE_CLASS = "scrollbar-active";
const EDGE_CLASS = "scrollbar-edge";
const EDGE_SIZE = 22;
const HIDE_DELAY_MS = 900;

export function ScrollActivity() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    let documentTimer = 0;

    function showScrollbar(element: Element) {
      element.classList.add(ACTIVE_CLASS);
      const currentTimer = timers.get(element);
      if (currentTimer) {
        window.clearTimeout(currentTimer);
      }
      timers.set(
        element,
        window.setTimeout(() => {
          element.classList.remove(ACTIVE_CLASS);
        }, HIDE_DELAY_MS)
      );
    }

    function showDocumentScrollbar() {
      document.documentElement.classList.add(ACTIVE_CLASS);
      if (documentTimer) {
        window.clearTimeout(documentTimer);
      }
      documentTimer = window.setTimeout(() => {
        document.documentElement.classList.remove(ACTIVE_CLASS);
      }, HIDE_DELAY_MS);
    }

    function scrollTarget(target: EventTarget | null) {
      if (target === document || target === window) {
        return document.documentElement;
      }
      return target instanceof Element ? target : null;
    }

    function onScroll(event: Event) {
      const target = scrollTarget(event.target);
      if (!target) {
        return;
      }
      if (target === document.documentElement) {
        showDocumentScrollbar();
        return;
      }
      if (target.matches(".custom-scrollbar, .leaderboard-table-wrap")) {
        showScrollbar(target);
      }
    }

    function onPointerMove(event: PointerEvent) {
      const hovered = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".custom-scrollbar, .leaderboard-table-wrap");

      document.querySelectorAll(`.${EDGE_CLASS}`).forEach((element) => {
        if (element !== hovered) {
          element.classList.remove(EDGE_CLASS);
        }
      });
      document.documentElement.classList.remove(EDGE_CLASS);

      if (hovered instanceof HTMLElement && isScrollable(hovered)) {
        const rect = hovered.getBoundingClientRect();
        const nearVerticalEdge = hovered.scrollHeight > hovered.clientHeight && event.clientX > rect.right - EDGE_SIZE;
        const nearHorizontalEdge = hovered.scrollWidth > hovered.clientWidth && event.clientY > rect.bottom - EDGE_SIZE;
        if (nearVerticalEdge || nearHorizontalEdge) {
          hovered.classList.add(EDGE_CLASS);
        }
        return;
      }

      const nearDocumentEdge = event.clientX > window.innerWidth - EDGE_SIZE || event.clientY > window.innerHeight - EDGE_SIZE;
      if (nearDocumentEdge && document.documentElement.scrollHeight > window.innerHeight) {
        document.documentElement.classList.add(EDGE_CLASS);
      }
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pointermove", onPointerMove);
      if (documentTimer) {
        window.clearTimeout(documentTimer);
      }
    };
  }, []);

  return null;
}

function isScrollable(element: HTMLElement) {
  return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

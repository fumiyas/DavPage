// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Persistent dismissable notification banners

const CONTAINER_ID = "davpage-notifications";

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "davpage-notifications";
    document.body.prepend(container);
  }
  return container;
}

/** Show a persistent error banner with a × dismiss button */
export function showError(message: string): void {
  const container = getOrCreateContainer();

  const item = document.createElement("div");
  item.className = "davpage-notification davpage-notification-error";
  item.setAttribute("role", "alert");

  const text = document.createElement("span");
  text.className = "davpage-notification-text";
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "davpage-notification-close";
  closeBtn.textContent = "×";
  closeBtn.title = "閉じる";
  closeBtn.addEventListener("click", () => item.remove());

  item.append(text, closeBtn);
  container.appendChild(item);
}

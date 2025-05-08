/**
 * @typedef {"primary" | "success" | "info" | "danger" | "warning"} BootstrapColors
 * @typedef {{
 *  initialPercentage: number;
 *  label?: string;
 *  color?: BootstrapColors;
 *  showPercentageLabel?: boolean;
 * }} ProgressBarProperties
 *
 * @typedef {{
 *  element: HTMLDivElement,
 *  updatePercentage: (percentage: number) => void;
 *  show: () => void;
 *  hide: () => void;
 *  dispose: () => void;
 * }} BookmarkBurstProgressBar
 */

/**
 * initialPercentage: {number} 0-100
 * label?: {string} optional - is not displayed visually
 * color?: {BootstrapColors} optional, "primary" by default
 * showPercentageLabel?: {boolean} optional, false by default
 * @param {ProgressBarProperties} props
 * @returns {BookmarkBurstProgressBar}
 */
export function createProgressBar({ initialPercentage, label, color, showPercentageLabel }) {
  if (initialPercentage < 0) {
    initialPercentage = 0;
  } else if (initialPercentage > 100) {
    initialPercentage = 100;
  }

  if (!color) {
    color = "primary";
  }

  const progressBarRoot = document.createElement("div");
  progressBarRoot.classList.add("progress", "d-none");

  const progressBarDisplay = document.createElement("div");
  progressBarDisplay.classList.add("progress-bar", `text-bg-${color}`);
  progressBarDisplay.style.width = `${initialPercentage}%`;
  if (showPercentageLabel !== undefined && showPercentageLabel) {
    progressBarDisplay.innerHTML = `${initialPercentage}%`;
  }

  const rootProgressBarAttributes = {
    role: "progressbar",
    "aria-label": label || "progress-bar________",
    "aria-valuenow": initialPercentage,
    "aria-valuemin": "0",
    "aria-valuemax": "100",
  };

  Object.entries(rootProgressBarAttributes).forEach(([key, value]) => {
    progressBarRoot.setAttribute(key, value);
  });

  progressBarRoot.appendChild(progressBarDisplay);

  return {
    element: progressBarRoot,
    /**
     * We normalize to 0 if <0. We normalize to 100 if >100.
     * @param {number} percentage
     */
    updatePercentage: (percentage) => {
      if (percentage < 0) {
        percentage = 0;
      } else if (percentage > 100) {
        percentage = 100;
      }
      progressBarRoot.setAttribute("aria-valuenow", percentage);
      progressBarDisplay.style.width = `${percentage}%`;
      if (showPercentageLabel !== undefined && showPercentageLabel) {
        progressBarDisplay.innerHTML = `${percentage}%`;
      }
    },
    show: () => {
      progressBarRoot.classList.remove("d-none");
    },
    hide: () => {
      progressBarRoot.classList.add("d-none");
    },
    dispose: () => {
      progressBarRoot.remove();
    },
  };
}

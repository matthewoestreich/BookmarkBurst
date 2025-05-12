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
 *
 * Usage:
 * ```
 *  const progressbar = createProgressBar({
 *    initialPercentage: 0,
 *    label: "my-progress-bar",
 *    color: "success",
 *    showPercentageLabel: true,
 *  });
 *
 *  // Manipulate the backing HTML element..
 *  progressbar.element.id = "foo-bar-baz";
 *  // etc..
 *
 *  // Add progress bar to DOM
 *  someElement.appendChild(progressbar.element);
 *
 *  // Show progress bar
 *  progressbar.show();
 *
 *  // Update progress bar
 *  for (let i = 1; i <= 10; i++) {
 *    await sleepMilliseconds(1000); // Pretend we are doing something...
 *    progressbar.updatePercentage(i * 10);
 *  }
 *
 *  // Hide progress bar if you want...
 *  progressbar.hide();
 *
 *  // Show again if you want...
 *  progressbar.updatePercentage(0);
 *  progressbar.show();
 *
 *  // Destroy DOM element, can't show after this..
 *  progressbar.dispose();
 * ```
 *
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
    "aria-label": label || "________bmb-progress-bar________",
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

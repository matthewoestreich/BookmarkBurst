const elToggleThemeButton = document.getElementById("toggle-theme");

elToggleThemeButton.addEventListener("click", () => {
  // If we are in dark mode, we need to show the light mode icon.
  const darkModeIcon = "bi-sun-fill";
  // If we are in light mode, we need to show the dark mode icon.
  const lightModeIcon = "bi-moon-stars-fill";
  const elThemeIcon = document.getElementById("theme-icon");
  const currentTheme = document.documentElement.getAttribute("data-bs-theme");
  if (currentTheme === "dark") {
    // Current theme is dark, we are switching to light.
    document.documentElement.setAttribute("data-bs-theme", "light");
    elThemeIcon.classList.remove(darkModeIcon);
    elThemeIcon.classList.add(lightModeIcon);
  } else {
    // Current theme is light, we are switching to dark.
    document.documentElement.setAttribute("data-bs-theme", "dark");
    elThemeIcon.classList.remove(lightModeIcon);
    elThemeIcon.classList.add(darkModeIcon);
  }
});

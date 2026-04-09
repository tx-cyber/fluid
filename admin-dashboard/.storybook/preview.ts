import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      // Storybook's built-in background picker — mirrors the app's light/dark surfaces
      default: "light",
      values: [
        { name: "light", value: "#f1f5f9" },   // slate-100 (app shell bg)
        { name: "dark", value: "#0f172a" },    // slate-900
        { name: "white", value: "#ffffff" },
      ],
    },
  },
  decorators: [
    // Dark-mode toggle via next-themes class strategy
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
};

export default preview;

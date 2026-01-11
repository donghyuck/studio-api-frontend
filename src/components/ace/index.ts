// src/ace/aceLoader.ts
import ace from "ace-builds";

export async function loadAce(lang: string, theme: string) {
  if (lang === "text") {
    await import("ace-builds/src-noconflict/mode-text");
  } else if (lang === "json") {
    await import("ace-builds/src-noconflict/mode-json");
    const workerUrl = (await import("ace-builds/src-noconflict/worker-json?url")).default;
    ace.config.setModuleUrl("ace/mode/json_worker", workerUrl);
  } else if (lang === "javascript") {
    await import("ace-builds/src-noconflict/mode-javascript");
    const workerUrl = (await import("ace-builds/src-noconflict/worker-javascript?url")).default;
    ace.config.setModuleUrl("ace/mode/javascript_worker", workerUrl);
  } else if (lang === "html") {
    await import("ace-builds/src-noconflict/mode-html");
    const workerUrl = (await import("ace-builds/src-noconflict/worker-html?url")).default;
    ace.config.setModuleUrl("ace/mode/html_worker", workerUrl);
  } else if (lang === "css") {
    await import("ace-builds/src-noconflict/mode-css");
    const workerUrl = (await import("ace-builds/src-noconflict/worker-css?url")).default;
    ace.config.setModuleUrl("ace/mode/css_worker", workerUrl);
  } else if (lang === "yaml") {
    await import("ace-builds/src-noconflict/mode-yaml");
    const workerUrl = (await import("ace-builds/src-noconflict/worker-yaml?url")).default;
    ace.config.setModuleUrl("ace/mode/yaml_worker", workerUrl);
  } else if (lang === "sql") {
    await import("ace-builds/src-noconflict/mode-sql");
  } else if (lang === "java") {
    await import("ace-builds/src-noconflict/mode-java");
  }
  const themeLoaders: Record<string, () => Promise<void>> = {
    chrome: async () => {
      await import("ace-builds/src-noconflict/theme-chrome");
    },
    github: async () => {
      await import("ace-builds/src-noconflict/theme-github");
    },
    monokai: async () => {
      await import("ace-builds/src-noconflict/theme-monokai");
    },
    solarized_dark: async () => {
      await import("ace-builds/src-noconflict/theme-solarized_dark");
    },
    solarized_light: async () => {
      await import("ace-builds/src-noconflict/theme-solarized_light");
    },
    tomorrow_night: async () => {
      await import("ace-builds/src-noconflict/theme-tomorrow_night");
    },
    twilight: async () => {
      await import("ace-builds/src-noconflict/theme-twilight");
    },
  };
  const themeLoader = themeLoaders[theme];
  if (themeLoader) {
    await themeLoader();
  }

  await import("ace-builds/src-noconflict/ext-searchbox");
}

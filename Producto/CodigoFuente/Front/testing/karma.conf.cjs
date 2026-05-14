const fs = require("fs");

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

if (!process.env.CHROME_BIN) {
  process.env.CHROME_BIN = browserCandidates.find(candidate => fs.existsSync(candidate));
}

module.exports = function configureKarma(config) {
  config.set({
    basePath: "..",
    frameworks: ["jasmine"],
    files: [
      { pattern: "testing/specs/**/*.spec.ts", watched: false },
    ],
    preprocessors: {
      "testing/specs/**/*.spec.ts": ["esbuild"],
    },
    esbuild: {
      bundle: true,
      format: "iife",
      platform: "browser",
      sourcemap: "inline",
      target: "es2020",
      tsconfig: "tsconfig.json",
      loader: {
        ".ts": "ts",
        ".tsx": "tsx",
      },
      define: {
        "import.meta.env.VITE_API_BASE_URL": "undefined",
        "import.meta.env.VITE_ENABLE_MOCK_DATA": "undefined",
      },
    },
    reporters: ["spec"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
    restartOnFileChange: true,
    client: {
      jasmine: {
        random: false,
      },
      clearContext: false,
    },
  });
};

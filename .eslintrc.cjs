module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  plugins: ["import", "prettier"],
  rules: {
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
      },
    ],
  },
  overrides: [
    {
      env: {
        browser: true,
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
};

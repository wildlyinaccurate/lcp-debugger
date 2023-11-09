module.exports = {
  env: {
    es2021: true,
    node: true,
    browser: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["import", "prettier"],
  rules: {
    "prettier/prettier": "error",
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

module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'plugin:react-hooks/recommended',
  ],
  plugins: [
    'react',
    'react-native',
    'react-hooks',
    'import',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
  },
  env: {
    'react-native/react-native': true,
    es6: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // React Rules
    'react/prop-types': 'off', // Since you're not using PropTypes
    'react/display-name': 'off',
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    
    // React Native Rules
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'warn',
    'react-native/no-inline-styles': 'off', // You use inline styles frequently
    'react-native/no-color-literals': 'off', // You use color literals
    'react-native/no-raw-text': 'off', // Allow raw text for now
    
    // React Hooks Rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // General JavaScript Rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    'no-debugger': 'warn',
    'no-alert': 'warn',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'warn',
    'prefer-template': 'warn',
    'object-shorthand': 'warn',
    'arrow-body-style': ['warn', 'as-needed'],
    
    // Import Rules
    'import/order': ['warn', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    'import/no-duplicates': 'error',
    'import/newline-after-import': 'warn',
    
    // Async/Await Rules
    'require-await': 'warn',
    'no-return-await': 'warn',
    
    // Best Practices
    'eqeqeq': ['warn', 'smart'],
    'no-else-return': 'warn',
    'no-empty-function': 'warn',
    'no-multi-spaces': 'warn',
    'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
    'no-trailing-spaces': 'warn',
    'comma-dangle': ['warn', 'always-multiline'],
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'jsx-quotes': ['warn', 'prefer-double'],
    'object-curly-spacing': ['warn', 'always'],
    'array-bracket-spacing': ['warn', 'never'],
    'space-in-parens': ['warn', 'never'],
    'block-spacing': 'warn',
    'key-spacing': 'warn',
    'keyword-spacing': 'warn',
    'space-before-blocks': 'warn',
    'space-before-function-paren': ['warn', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always',
    }],
    'space-infix-ops': 'warn',
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
  },
  globals: {
    __DEV__: 'readonly',
    fetch: 'readonly',
    FormData: 'readonly',
    XMLHttpRequest: 'readonly',
    WebSocket: 'readonly',
    alert: 'readonly',
    process: 'readonly',
  },
  ignorePatterns: [
    'node_modules/',
    'ios/',
    'android/',
    '.expo/',
    'coverage/',
    'dist/',
    'build/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
  ],
};
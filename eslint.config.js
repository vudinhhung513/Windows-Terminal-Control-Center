// file: eslint.config.js
// Chuc nang: Cau hinh ESLint (flat config) cho du an.
// Backend (src/, test/) chay tren Node ESM; frontend (public/js) chay tren trinh duyet.

export default [
  {
    // Quy tac chung cho file backend Node.js (ESM)
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  },
  {
    // Quy tac cho frontend script trinh duyet (khong phai module)
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        CustomEvent: 'readonly',
        WebSocket: 'readonly',
        Terminal: 'readonly',
        FitAddon: 'readonly',
        ResizeObserver: 'readonly',
        URLSearchParams: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    // Bo qua thu muc khong can lint
    ignores: ['node_modules/**', 'public/vendor/**']
  }
];

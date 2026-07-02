import { defineConfig, globalIgnores } from 'eslint/config';
import { defineReactConfig } from '../../eslint.config.base.js';

import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineReactConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])]);

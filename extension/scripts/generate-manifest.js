#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

const manifest = {
  manifest_version: 3,
  name: isDev ? 'Magpie Extension (Dev)' : 'Magpie Extension',
  version: '1.0.0',
  description: 'Save interesting links to your Magpie collection',
  
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  },
  
  background: {
    service_worker: 'src/background/background.js',
    type: 'module'
  },
  
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    },
    default_title: 'Save to Magpie'
  },
  
  options_page: 'src/options/options.html',
  
  permissions: [
    'activeTab',
    'storage',
    'contextMenus',
    'notifications'
  ],
  
  host_permissions: isDev ? [
    'http://localhost:3001/*',
    'http://localhost:3000/*'
  ] : [
    'https://*/*'
  ],
  
  content_security_policy: {
    extension_pages: isDev 
      ? "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
      : "script-src 'self'; object-src 'self'"
  }
};

// Write manifest to dist directory
const distPath = path.join(process.cwd(), 'dist', 'manifest.json');
fs.writeFileSync(distPath, JSON.stringify(manifest, null, 2));

console.log(`Generated ${isDev ? 'development' : 'production'} manifest.json`);
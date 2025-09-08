#!/usr/bin/env node

/**
 * Generate Chrome Extension icons from the main Magpie app icon
 * This script takes the main app icon and generates all required sizes for the Chrome Extension
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(EXTENSION_ROOT, '..');
const SOURCE_ICON = path.join(PROJECT_ROOT, 'apps/web/public/magpie-icon.png');
const ICONS_DIR = path.join(EXTENSION_ROOT, 'icons');

// Chrome Extension icon sizes
const ICON_SIZES = [
  16,  // Toolbar icon (small)
  48,  // Extension management page
  128, // Chrome Web Store
];

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function generateIcon(size) {
  const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
  
  console.log(`Generating ${size}x${size} icon...`);
  
  await sharp(SOURCE_ICON)
    .resize(size, size, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({
      quality: 100,
      compressionLevel: 6,
    })
    .toFile(outputPath);
    
  console.log(`✓ Generated ${outputPath}`);
}

async function copySourceIcon() {
  // Also copy the original icon as icon.png for reference
  const destPath = path.join(ICONS_DIR, 'icon.png');
  await fs.copyFile(SOURCE_ICON, destPath);
  console.log(`✓ Copied source icon to ${destPath}`);
}

async function generateIcons() {
  console.log('🎨 Generating Chrome Extension icons from Magpie app icon...\n');
  
  // Check if source icon exists
  try {
    await fs.access(SOURCE_ICON);
  } catch (error) {
    console.error(`❌ Source icon not found: ${SOURCE_ICON}`);
    console.error('Make sure the main app icon exists in apps/web/public/magpie-icon.png');
    process.exit(1);
  }
  
  // Ensure icons directory exists
  await ensureDir(ICONS_DIR);
  
  // Generate all required sizes
  for (const size of ICON_SIZES) {
    await generateIcon(size);
  }
  
  // Copy original for reference
  await copySourceIcon();
  
  console.log('\n🎉 All icons generated successfully!');
  console.log('\nGenerated files:');
  for (const size of ICON_SIZES) {
    console.log(`  - icons/icon${size}.png (${size}x${size})`);
  }
  console.log('  - icons/icon.png (original)');
}

// Run the script
generateIcons().catch((error) => {
  console.error('❌ Failed to generate icons:', error);
  process.exit(1);
});
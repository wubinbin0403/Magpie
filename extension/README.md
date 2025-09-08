# Magpie Chrome Extension

A Chrome Extension that allows you to quickly save interesting links to your Magpie collection with one click.

## Features

- **One-Click Saving**: Save the current page to your Magpie collection directly from the browser
- **Right-Click Context Menu**: Save links from right-click context menu  
- **Customizable Categories**: Organize links with categories
- **Tag Support**: Add tags to categorize and organize your links
- **Auto-Publish Mode**: Option to automatically publish links without confirmation
- **Offline Support**: Works even when your server is temporarily unavailable
- **Beautiful UI**: Clean and intuitive popup interface

## Installation

### Development Installation

1. **Build the Extension**:
   ```bash
   pnpm -F @magpie/extension build
   ```
   
   This will create a `dist/` directory with all the built extension files.

2. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the `extension/dist` folder
   - The Magpie extension should now appear in your browser

3. **Verify Installation**:
   - You should see the Magpie icon in your Chrome toolbar
   - Click it to open the popup (will show "Configuration Required" initially)

### Production Installation

*Once published to Chrome Web Store:*

1. Visit the Chrome Web Store page for Magpie Extension
2. Click "Add to Chrome"
3. Confirm the installation

## Setup and Configuration

### Initial Setup

1. **Click the Extension Icon**: After installation, click the Magpie icon in your Chrome toolbar
2. **Configure Settings**: You'll be prompted to configure your settings:
   - **Server URL**: The URL of your Magpie server (e.g., `https://your-magpie-server.com`)
   - **API Token**: Your personal API token from your Magpie server
3. **Test Connection**: Use the "Test Connection" button to verify your settings

### Getting Your API Token

1. Open your Magpie web interface
2. Navigate to the Admin page (`/admin`)
3. Go to the "API Tokens" section
4. Generate a new token or copy an existing one
5. Paste this token in the extension settings

## Usage

### Saving Pages

**Method 1: Extension Icon**
1. Navigate to any webpage you want to save
2. Click the Magpie extension icon in the toolbar
3. Optionally modify the category and tags
4. Click "Save for Review" or "Publish Now"

**Method 2: Right-Click Menu**
1. Right-click anywhere on a webpage
2. Select "Save to Magpie" or "Save to Magpie (Auto-publish)"
3. The link will be saved automatically

### Managing Categories and Tags

- **Categories**: Choose from existing categories or create new ones
- **Tags**: Add up to 5 tags, separated by commas
- **Default Settings**: Set default categories and tags in the options page

### Options Page

Access via:
- Right-click the extension icon → "Magpie Options"
- Right-click on any page → "Magpie Options"

Configure:
- Server URL and API token
- Default category and tags
- Auto-publish preferences
- Test your connection

## Development

### Project Structure

```
extension/
├── src/
│   ├── background/     # Background service worker
│   ├── popup/          # Extension popup interface
│   ├── options/        # Options/settings page
│   ├── shared/         # Shared utilities and types
│   │   ├── types.ts    # TypeScript type definitions
│   │   ├── api.ts      # API client
│   │   ├── storage.ts  # Chrome storage management
│   │   └── utils.ts    # Utility functions
│   └── test/           # Unit tests
├── icons/              # Extension icons
├── dist/               # Built extension (after build)
└── scripts/            # Build scripts
```

### Development Commands

```bash
# Install dependencies
pnpm install

# Development build (with watch mode)
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix
```

### Building

The extension uses Vite with the `vite-plugin-web-extension` plugin for building:

1. **Development Build**: `pnpm build:dev`
   - Includes source maps
   - Relaxed content security policy
   - Development manifest

2. **Production Build**: `pnpm build`
   - Minified and optimized
   - Production manifest
   - Strict CSP

### Testing

The extension includes comprehensive unit tests:

- **Utility Functions**: URL validation, tag parsing, string sanitization
- **Storage Management**: Chrome storage API interactions
- **API Client**: HTTP communication with Magpie server

Run tests with: `pnpm test`

### Architecture

**Manifest V3**: Uses the latest Chrome Extension Manifest V3 with:
- Service Worker for background tasks
- Chrome Storage API for configuration
- Context Menus API for right-click functionality
- Notifications API for user feedback

**TypeScript**: Fully typed codebase with strict type checking

**Modern Build Tools**: Vite for fast building and hot module replacement during development

## Permissions

The extension requires these permissions:

- **activeTab**: To access the current webpage for saving
- **storage**: To store user preferences and configuration  
- **contextMenus**: To add right-click menu options
- **notifications**: To show save success/error messages
- **host_permissions**: To communicate with your Magpie server

## Privacy

- The extension only communicates with your configured Magpie server
- No data is sent to third parties
- All configuration is stored locally in your browser
- API tokens are stored securely using Chrome's storage API

## Troubleshooting

### Connection Issues

1. **Verify Server URL**: Make sure your server URL is correct and accessible
2. **Check API Token**: Ensure your API token is valid and hasn't expired
3. **Test Connection**: Use the "Test Connection" button in options
4. **Check Network**: Ensure your Magpie server is running and accessible

### Permission Issues

1. **Check Host Permissions**: The extension needs permission to access your server
2. **CORS Settings**: Ensure your Magpie server allows requests from the extension
3. **HTTPS Requirements**: Chrome requires HTTPS for most production servers

### General Issues

1. **Reload Extension**: Try reloading the extension in `chrome://extensions/`
2. **Check Console**: Look for errors in the browser console or extension popup
3. **Clear Storage**: Reset extension settings if needed

## Support

For issues and bug reports, please visit the [Magpie project repository](https://github.com/your-org/magpie).

## License

This extension is part of the Magpie project and follows the same license terms.
# Testing Guide for Magpie Chrome Extension

This guide will help you test the Magpie Chrome Extension functionality.

## Prerequisites

1. **Magpie Server Running**: Ensure your Magpie server is running locally or accessible
   - Default development server: `http://localhost:3001`
   - API should be accessible at `/api/links`, `/api/health`, etc.

2. **API Token**: Get an API token from your Magpie admin interface

## Installation for Testing

1. **Build the Extension**:
   ```bash
   pnpm -F @magpie/extension build
   ```
   
   ✅ **Expected Result**: Build should complete successfully with output in `dist/` directory

2. **Load in Chrome**:
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension/dist` folder
   - Extension should appear in your extensions list
   
   ✅ **Expected Result**: Magpie extension appears with green "Enabled" toggle

## Testing Checklist

### ✅ Initial Setup

1. **Extension Icon**: Verify the Magpie icon appears in Chrome toolbar
2. **Click Icon**: Should open popup
3. **First Time**: Should show "Configuration Required" screen
4. **Options Button**: Click gear icon should open options page

### ✅ Configuration

1. **Options Page**:
   - Right-click extension icon → "Magpie Options"
   - Should show settings form

2. **Required Fields**:
   - Server URL: `http://localhost:3001` (or your server URL)
   - API Token: Paste your API token

3. **Test Connection**:
   - Click "Test Connection" button
   - Should show success/failure message
   - Verify authentication status

4. **Save Settings**:
   - Click "Save Settings"
   - Should show success message

### ✅ Basic Functionality

1. **Navigate to a Website**: Go to any webpage (e.g., `https://github.com`)

2. **Extension Popup**:
   - Click Magpie extension icon
   - Should show main interface with:
     - Current page title and URL
     - Category dropdown
     - Tags input field
     - "Save for Review" and "Publish Now" buttons

3. **Page Information**:
   - Verify page title is displayed correctly
   - Verify URL is shown (truncated if long)

### ✅ Saving Links

1. **Save for Review**:
   - Optionally change category
   - Optionally add tags (comma-separated)
   - Click "Save for Review"
   - Should show success notification
   - Popup should close after ~1.5 seconds

2. **Publish Now**:
   - Click "Publish Now" button
   - Should save with `skipConfirm=true`
   - Should show "Link published" notification

3. **Verify in Magpie**:
   - Check your Magpie web interface
   - Links should appear in pending (Save for Review) or published (Publish Now)

### ✅ Context Menu

1. **Right-Click on Page**:
   - Should see "Save to Magpie" option
   - Should see "Save to Magpie (Auto-publish)" option
   - Should see "Magpie Options" option

2. **Test Context Menu Saving**:
   - Right-click → "Save to Magpie"
   - Should save current page
   - Should show browser notification

### ✅ Default Values

1. **Set Defaults in Options**:
   - Set default category (e.g., "test")
   - Set default tags (e.g., "extension, test")
   - Save settings

2. **Test Defaults**:
   - Open popup on a new page
   - Default category should be selected
   - Default tags should be pre-filled

### ✅ Error Handling

1. **Invalid Server**:
   - Set invalid server URL in options
   - Try to save a link
   - Should show error message

2. **No Network**:
   - Disconnect internet or stop Magpie server
   - Try to save a link
   - Should show appropriate error message

3. **Invalid Token**:
   - Set invalid API token
   - Test connection should fail
   - Saving should fail with auth error

### ✅ Edge Cases

1. **Special URLs**:
   - Test with `chrome://` pages (should show warning or handle gracefully)
   - Test with very long URLs
   - Test with special characters in titles

2. **Long Page Titles**:
   - Navigate to page with very long title
   - Should truncate in popup display

3. **Many Tags**:
   - Enter more than 5 tags
   - Should limit to 5 tags maximum

## Browser Console Testing

Open Chrome DevTools (F12) and check:

1. **Extension Console**:
   - Go to `chrome://extensions/`
   - Click "Inspect views: service worker" under Magpie extension
   - Check for JavaScript errors

2. **Popup Console**:
   - Right-click extension popup → "Inspect"
   - Check console for errors during interactions

3. **Options Console**:
   - Right-click options page → "Inspect"
   - Check for errors during configuration

## Expected Behaviors

### ✅ Notifications

- Success saves should show Chrome notifications
- Error states should show error notifications
- Notifications should disappear automatically

### ✅ Visual States

- Loading states during saving (buttons become disabled)
- Success/error status messages
- Form validation (required fields)

### ✅ Storage

- Settings should persist between browser sessions
- Extension should remember configuration
- Default values should be applied correctly

## Troubleshooting Common Issues

1. **Extension Doesn't Load**:
   - Check console for manifest errors
   - Verify all files are in dist directory
   - Try reloading extension

2. **API Calls Fail**:
   - Verify server is running
   - Check CORS settings on server
   - Verify API token is valid

3. **Popup Doesn't Show**:
   - Check for JavaScript errors
   - Verify HTML files are built correctly
   - Try refreshing extension

4. **Context Menu Missing**:
   - Verify contextMenus permission in manifest
   - Check background script console for errors

## Automated Testing

Run the unit tests to verify core functionality:

```bash
pnpm -F @magpie/extension test
```

This tests:
- Utility functions (URL validation, tag parsing, etc.)
- Storage management
- Core business logic

## Manual Test Script

For systematic testing, follow this script:

1. ✅ Install extension
2. ✅ Configure with valid settings
3. ✅ Save a link via popup
4. ✅ Save a link via context menu
5. ✅ Test with different categories
6. ✅ Test with multiple tags
7. ✅ Test auto-publish mode
8. ✅ Test error scenarios
9. ✅ Verify in Magpie web interface
10. ✅ Test options page functionality

## Success Criteria

The extension passes testing if:

- ✅ All installation steps complete without errors
- ✅ Configuration can be saved and persists
- ✅ Links can be saved via popup and context menu
- ✅ Appropriate notifications are shown
- ✅ Error states are handled gracefully
- ✅ No JavaScript console errors
- ✅ Saved links appear correctly in Magpie web interface
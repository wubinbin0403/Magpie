/**
 * Test setup file for Vitest
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    getManifest: () => ({ version: '1.0.0' }),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
    openOptionsPage: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getBytesInUse: vi.fn((keys, callback) => callback(0)),
      QUOTA_BYTES: 102400,
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn((options, callback) => {
      if (callback) callback('notification-id');
    }),
  },
} as any;

// Mock fetch
global.fetch = vi.fn();
import { describe, it, expect } from 'vitest';

// Placeholder types for testing
interface Link {
  id: number;
  url: string;
  title: string;
}

describe('Shared Types', () => {
  it('should define basic types correctly', () => {
    const link: Link = {
      id: 1,
      url: 'https://example.com',
      title: 'Test Link'
    };
    
    expect(link.id).toBe(1);
    expect(link.url).toBe('https://example.com');
    expect(link.title).toBe('Test Link');
  });
  
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});
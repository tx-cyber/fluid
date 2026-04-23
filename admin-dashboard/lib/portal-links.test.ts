import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPortalLinks } from './portal-links';

describe('getPortalLinks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should return default URLs when environment variables are not set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_DOCS_URL;
    delete process.env.NEXT_PUBLIC_GITHUB_URL;
    delete process.env.NEXT_PUBLIC_DISCORD_URL;
    delete process.env.NEXT_PUBLIC_HELP_CENTER_URL;
    delete process.env.NEXT_PUBLIC_SUPPORT_URL;

    const links = getPortalLinks();

    expect(links.siteUrl).toBe('http://localhost:3000');
    expect(links.docs).toBe('https://docs.fluid.dev');
    expect(links.github).toBe('https://github.com/fluid-org/fluid');
    expect(links.discord).toBe('https://discord.gg/fluid');
    expect(links.helpCenter).toBe('https://help.fluid.dev');
    expect(links.support).toBe('https://support.fluid.dev/tickets');
  });

  it('should return environment variable values when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-site.com';
    process.env.NEXT_PUBLIC_DOCS_URL = 'https://custom-docs.com';
    process.env.NEXT_PUBLIC_GITHUB_URL = 'https://custom-github.com';
    process.env.NEXT_PUBLIC_DISCORD_URL = 'https://custom-discord.com';
    process.env.NEXT_PUBLIC_HELP_CENTER_URL = 'https://custom-help.com';
    process.env.NEXT_PUBLIC_SUPPORT_URL = 'https://custom-support.com';

    const links = getPortalLinks();

    expect(links.siteUrl).toBe('https://custom-site.com');
    expect(links.docs).toBe('https://custom-docs.com');
    expect(links.github).toBe('https://custom-github.com');
    expect(links.discord).toBe('https://custom-discord.com');
    expect(links.helpCenter).toBe('https://custom-help.com');
    expect(links.support).toBe('https://custom-support.com');
  });
});

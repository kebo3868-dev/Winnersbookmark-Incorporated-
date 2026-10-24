import { describe, expect, it } from 'vitest';
import { robotsAllows } from '@/lib/web/robots';
import { isPrivateAddress, validateUrlSyntax } from '@/lib/validation/url';

describe('bounded public crawler policy', () => {
  it('honors wildcard rules and more-specific Allow exceptions', () => {
    const policy = 'User-agent: *\nDisallow: /private\nAllow: /private/menu\nDisallow: /*?token=*';
    expect(robotsAllows(policy, '/private/bookings')).toBe(false);
    expect(robotsAllows(policy, '/private/menu')).toBe(true);
    expect(robotsAllows(policy, '/menu?token=123')).toBe(false);
    expect(robotsAllows(policy, '/menu')).toBe(true);
  });
  it('selects this crawler group over generic policy and ignores other bots', () => {
    const policy = 'User-agent: *\nDisallow: /\nUser-agent: WinnersBookmarkRescueAgent\nAllow: /menu\nDisallow: /\nUser-agent: OtherBot\nAllow: /';
    expect(robotsAllows(policy, '/menu')).toBe(true);
    expect(robotsAllows(policy, '/contact')).toBe(false);
  });
  it('honors terminal patterns and empty disallow', () => {
    expect(robotsAllows('User-agent: *\nDisallow:\nDisallow: /file$', '/files')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /file$', '/file')).toBe(false);
  });
  it.each(['ff02::1', '2001:db8::1', '2002:7f00:1::', '3fff::1', '203.0.113.2', '198.51.100.1'])('blocks reserved address %s', (address) => expect(isPrivateAddress(address)).toBe(true));
  it('rejects credentials embedded in scan URLs', () => expect(validateUrlSyntax('https://user:password@example.com').ok).toBe(false));
});

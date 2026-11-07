import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const { parseVoiceCommand } = await import('./voice');

describe('voice commands', () => {
  it.each([
    ['next step please', 'next'],
    ['go back', 'back'],
    ['read that again', 'repeat'],
    ['start the timer', 'timer'],
    ['show ingredients', 'ingredients'],
    ["I'm done", 'done'],
    ['hello there', undefined],
  ])('%s -> %s', (phrase, command) => {
    expect(parseVoiceCommand(phrase)).toBe(command);
  });
});

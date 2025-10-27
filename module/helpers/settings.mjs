/**
 * Lore System Settings (Template)
 *
 * This file intentionally contains no functional logic.
 * It serves as a template showing where and how to register settings.
 *
 * To enable settings later, add game.settings.register calls inside
 * registerSystemSettings() and wire up any effects in your own hooks.
 */
export function registerSystemSettings() {
  // Global Target Number (DV) used to evaluate success/failure for rolls.
  // 0 means "not set"; when > 0, all rolls use this target number for outcome evaluation.
  game.settings.register('lore', 'targetNumberValue', {
    name: 'Target Number',
    hint: 'When greater than zero, all rolls use this target number to determine success or failure. Only GMs can change it via the hotbar widget.',
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
  });
}

/**
 * LoreMorale encapsulates the morale slider/value UI for the Lore actor sheet.
 */
export class LoreMorale {
  /**
   * @param {import('../sheets/actor-sheet.mjs').loreActorSheet} sheet
   */
  constructor(sheet) {
    this.sheet = sheet;
  }

  /**
   * Attach morale slider/value bindings to the current sheet root element.
   * Safe to call on each render.
   * @param {HTMLElement} rootEl
   */
  attach(rootEl) {
    if (!rootEl) return;

    const input = rootEl.querySelector('.morale-input');
    const valueEl = rootEl.querySelector('.morale-value');
    if (!input || !valueEl) return;

    // Initialize display value from actor
    valueEl.textContent = String(this.sheet.actor.system?.morale ?? 0);

    // Input handler updates the displayed number live
    const onInput = (e) => {
      valueEl.textContent = input.value;
    };
    if (input._loreMoraleInputHandler) input.removeEventListener('input', input._loreMoraleInputHandler);
    input.addEventListener('input', onInput);
    input._loreMoraleInputHandler = onInput;

    // Change handler commits to the actor system
    const onChange = async (e) => {
      const newMorale = Number(input.value) || 0;
      await this.sheet.actor.update({ 'system.morale': newMorale });
    };
    if (input._loreMoraleChangeHandler) input.removeEventListener('change', input._loreMoraleChangeHandler);
    input.addEventListener('change', onChange);
    input._loreMoraleChangeHandler = onChange;
  }
}

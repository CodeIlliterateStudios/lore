/**
 * LoreWoundsFatigue encapsulates wounds and fatigue UI setup and change handling
 * for the Lore actor sheet.
 */
export class LoreWoundsFatigue {
  /**
   * @param {import('../sheets/actor-sheet.mjs').loreActorSheet} sheet
   */
  constructor(sheet) {
    this.sheet = sheet;

    // Stable bound handlers to allow proper removeEventListener during re-renders
    this._onWoundsChangeBound = this._onWoundsChange.bind(this);
    this._onFatigueChangeBound = this._onFatigueChange.bind(this);
  }

  /**
   * Attach initialization and change listeners to the current sheet root element.
   * Safe to call on each render.
   * @param {HTMLElement} rootEl
   */
  attach(rootEl) {
    if (!rootEl) return;

    // Wounds
    const woundsValue = Number(this.sheet.actor.system?.wounds?.value ?? 0);
    const woundsMax = Number(this.sheet.actor.system?.wounds?.max ?? 3);
    const woundBoxes = rootEl.querySelectorAll('input.wounds-checkbox');
    for (const cb of woundBoxes) {
      const idx = Math.max(1, Math.min(Number(cb.value) || 0, woundsMax));
      cb.checked = idx <= woundsValue;
      cb.removeEventListener('change', this._onWoundsChangeBound);
      cb.addEventListener('change', this._onWoundsChangeBound);
    }

    // Fatigue
    const fatigueValue = Number(this.sheet.actor.system?.fatigue?.value ?? 0);
    const fatigueMax = Number(this.sheet.actor.system?.fatigue?.max ?? 3);
    const fatigueBoxes = rootEl.querySelectorAll('input.fatigue-checkbox');
    for (const cb of fatigueBoxes) {
      const idx = Math.max(1, Math.min(Number(cb.value) || 0, fatigueMax));
      cb.checked = idx <= fatigueValue;
      cb.removeEventListener('change', this._onFatigueChangeBound);
      cb.addEventListener('change', this._onFatigueChangeBound);
    }
  }

  /**
   * Handle wounds checkbox change
   * @param {Event} event
   */
  async _onWoundsChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const input = event.currentTarget;
    const idx = Math.max(1, Number(input.value) || 1);
    const current = Number(this.sheet.actor.system?.wounds?.value ?? 0);
    const max = Number(this.sheet.actor.system?.wounds?.max ?? 3);
    let next = current;
    if (input.checked) next = idx; else next = Math.min(current, idx - 1);
    next = Math.max(0, Math.min(next, max));
    if (next !== current) await this.sheet.actor.update({ 'system.wounds.value': next });

    // Reflect immediately
    const boxes = this.sheet.element.querySelectorAll('input.wounds-checkbox');
    for (const cb of boxes) {
      const v = Math.max(1, Number(cb.value) || 1);
      cb.checked = v <= next;
    }
  }

  /**
   * Handle fatigue checkbox change
   * @param {Event} event
   */
  async _onFatigueChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const input = event.currentTarget;
    const idx = Math.max(1, Number(input.value) || 1);
    const current = Number(this.sheet.actor.system?.fatigue?.value ?? 0);
    const max = Number(this.sheet.actor.system?.fatigue?.max ?? 3);
    let next = current;
    if (input.checked) next = idx; else next = Math.min(current, idx - 1);
    next = Math.max(0, Math.min(next, max));
    if (next !== current) await this.sheet.actor.update({ 'system.fatigue.value': next });

    // Reflect immediately
    const boxes = this.sheet.element.querySelectorAll('input.fatigue-checkbox');
    for (const cb of boxes) {
      const v = Math.max(1, Number(cb.value) || 1);
      cb.checked = v <= next;
    }
  }
}

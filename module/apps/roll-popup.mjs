// RollPopup Application for dynamic roll pop-ups
// Use the global Application class provided by Foundry VTT

export class RollPopup extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor({ rollType = "generic", rollData = {}, label = "", options = {}, showDifficulty = true } = {}) {
    // Pass rendering options to super but don't overwrite the Application.options property.
    super(options);
    this.rollType = rollType;
    this.rollData = rollData;
    this.label = label;
    this.showDifficulty = !!showDifficulty;
    // Keep popup-specific options separate to avoid clobbering Application internals
    this.popupOptions = options || {};
    // Track a simple numeric modifier entered by the user in the popup
    this.modifier = 0;
    // Track difficulty entered by the user in the popup
    this.difficulty = 0;
  }

  /**
   * Window title shown in the header.
   * Prefer the provided roll label, otherwise fall back to configured options or the default.
   */
  get title() {
    return this.label || this.options?.title || this.constructor.DEFAULT_OPTIONS?.title || "";
  }

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS ?? {},
    {
      title: "Roll Result",
      // Use a system-qualified path so Foundry resolves the template inside this system
      template: "systems/lore/templates/roll-popup.hbs",
      width: 400,
      height: "auto",
      resizable: true,
    }
  );

  /** @override */
  getData() {
    const target = this.#getCurrentTargetInfo();
    return {
      title: this.title,
      rollType: this.rollType,
      rollData: this.rollData,
      label: this.label,
      options: this.popupOptions,
      showDifficulty: this.showDifficulty,
      target,
    };
  }

  /** @override */
  async _prepareContext(options) {
    // Provide the same render context the template expects
    const target = this.#getCurrentTargetInfo();
    return {
      title: this.title,
      rollType: this.rollType,
      rollData: this.rollData,
      label: this.label,
      options: this.popupOptions,
      showDifficulty: this.showDifficulty,
      target,
    };
  }
  /** @override */
  async _onRender(context, options) {
    // Called after rendering by the ApplicationV2 lifecycle. Use this to attach listeners.
    // `this.element` is the rendered HTMLElement/container
    const $el = $(this.element);
    try {
      const content = this.element.querySelector('.window-content');
      const isEmpty = content && (!content.innerHTML || content.innerHTML.trim().length === 0);
      // If the content area is empty, try to render and inject the template explicitly
      if (isEmpty) {
        try {
          const tplPath = 'systems/lore/templates/roll-popup.hbs';
          // If the template is registered, renderTemplate will use the template; otherwise it will fetch/compile it.
          const compiled = await foundry.applications.handlebars.renderTemplate(tplPath, context);
          content.innerHTML = compiled;
        } catch (e) {
          console.error('Failed to renderTemplate for roll-popup.hbs', e);
        }
      }
    } catch (e) {
      console.error('Error in RollPopup _onRender', e);
    }
    // Attach listeners to the rendered DOM
    $el.find('.close-popup').off('click').on('click', () => this.close());
    // Keep the modifier property in sync with the input field
    const $mod = $el.find('#modifier-input');
  const $diff = $el.find('#difficulty-input');
    const $formula = $el.find('.roll-formula');
    const baseFormula = this.rollData?.formula ?? '';
    const renderFormula = (base, mod) => {
      const n = Number(mod) || 0;
      if (n === 0) return base;
      const sign = n >= 0 ? '+' : '-';
      const abs = Math.abs(n);
      return `${base} ${sign} ${abs}`;
    };
    const parseMod = (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    };
    const parseDiff = (val) => {
      const n = Number(val);
      // Difficulty cannot be negative; treat NaN as 0 (meaning no check)
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    };
    if ($mod.length) {
      // Initialize from current input value
      this.modifier = parseMod($mod.val());
      // Update the visual formula preview on open
      if ($formula.length) $formula.text(renderFormula(baseFormula, this.modifier));
      $mod.off('input change').on('input change', (ev) => {
        this.modifier = parseMod(ev.currentTarget.value);
        if ($formula.length) $formula.text(renderFormula(baseFormula, this.modifier));
      });
    }

    // Keep difficulty in sync
    if ($diff.length) {
      // If a global DV is set, use it as the default value in the field
      const globalDV = Math.max(0, Number(game.settings.get('lore', 'difficultyValue') || 0));
      if (globalDV > 0) $diff.val(globalDV);
      this.difficulty = parseDiff($diff.val());
      $diff.off('input change').on('input change', (ev) => {
        this.difficulty = parseDiff(ev.currentTarget.value);
      });
    }

    $el.find('.confirm-roll').off('click').on('click', () => {
      // Ensure we capture the latest modifier value right before confirm
      if ($mod.length) this.modifier = parseMod($mod.val());
      if ($diff.length) this.difficulty = parseDiff($diff.val());
      if (this._confirmResolve) this._confirmResolve(true);
      this.close();
    });
  }

  /**
   * Return a promise that resolves when the user confirms the popup.
   * Allows callers to await the confirmation before continuing a roll.
   * @returns {Promise<boolean>}
   */
  awaitConfirm() {
    if (this._confirmPromise) return this._confirmPromise;
    this._confirmPromise = new Promise((resolve) => {
      this._confirmResolve = resolve;
    });
    return this._confirmPromise;
  }

  /**
   * Safely get the current user's first targeted token info (name/img/id).
   * Returns null if there is no current target.
   * @returns {{name:string, img:string|null, id:string|null}|null}
   */
  #getCurrentTargetInfo() {
    try {
      const user = game?.user;
      if (!user) return null;
      const tset = user.targets;
      let tok = null;
      if (tset && typeof tset.size === 'number') {
        // Set or Collection
        const it = tset.values?.() ?? tset[Symbol.iterator]?.();
        tok = it ? it.next()?.value ?? null : null;
      } else if (Array.isArray(tset)) {
        tok = tset[0] ?? null;
      } else if (user.target) {
        tok = user.target;
      }
      if (!tok) return null;
      const name = tok.name ?? tok.document?.name ?? tok.actor?.name ?? null;
      const img = tok.texture?.src ?? tok.document?.texture?.src ?? tok.actor?.img ?? null;
      const id = tok.id ?? tok.document?.id ?? null;
      if (!name) return null;
      return { name, img, id };
    } catch (e) {
      console.warn('LORE | Failed to resolve current target for RollPopup:', e);
      return null;
    }
  }
}

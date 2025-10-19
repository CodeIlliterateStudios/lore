// RollPopup Application for dynamic roll pop-ups
// Use the global Application class provided by Foundry VTT

export class RollPopup extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor({ rollType = "generic", rollData = {}, label = "", options = {} } = {}) {
    // Pass rendering options to super but don't overwrite the Application.options property.
    super(options);
  this.rollType = rollType;
    this.rollData = rollData;
  this.label = label;
    // Keep popup-specific options separate to avoid clobbering Application internals
    this.popupOptions = options || {};
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
      classes: ["lore-roll-popup"],
    }
  );

  /** @override */
  getData() {
    return {
      title: this.title,
      rollType: this.rollType,
      rollData: this.rollData,
      label: this.label,
      options: this.popupOptions,
    };
  }

  /** @override */
  async _prepareContext(options) {
    // Provide the same render context the template expects
    return {
      title: this.title,
      rollType: this.rollType,
      rollData: this.rollData,
      label: this.label,
      options: this.popupOptions,
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
    $el.find('.confirm-roll').off('click').on('click', () => {
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
}

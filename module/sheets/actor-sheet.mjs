import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { RollPopup } from '../apps/roll-popup.mjs';

const { api, sheets } = foundry.applications;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class loreActorSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
    // Bind handlers once to keep stable references across renders
    this.#onAttributeContextMenuBound = (ev) => this.#onAttributeContextMenu(ev);
    this.#onItemContextMenuBound = (ev) => this.#onItemContextMenu(ev);
    this.#onSkillsHeaderContextMenuBound = (ev) => this.#onSkillsHeaderContextMenu(ev);
    this.#onGearHeaderContextMenuBound = (ev) => this.#onGearHeaderContextMenu(ev);
    // Bind wounds/fatigue handlers
    this.#onWoundsCheckboxChangeBound = (ev) => this.#onWoundsCheckboxChange(ev);
    this.#onFatigueCheckboxChangeBound = (ev) => this.#onFatigueCheckboxChange(ev);
    // Track collapsed lists for this sheet instance so state persists across re-renders
    this.#collapsedLists = new Set();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['lore', 'actor'],
    position: {
      width: 600,
      height: 600,
    },
    actions: {
      onEditImage: this._onEditImage,
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      roll: this._onRoll,
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    sidebar: {
      template: 'systems/lore/templates/actor/sidebar.hbs',
    },
    header: {
      template: 'systems/lore/templates/actor/header.hbs',
    },
    tabs: {
      // Use local template to ensure availability
      template: 'systems/lore/templates/tab-navigation.hbs',
    },
    skills: {
      template: 'systems/lore/templates/actor/skills.hbs',
    },
    biography: {
      template: 'systems/lore/templates/actor/biography.hbs',
    },
    gear: {
      template: 'systems/lore/templates/actor/gear.hbs',
    },
    magicks: {
      template: 'systems/lore/templates/actor/magicks.hbs',
    },
    effects: {
      template: 'systems/lore/templates/actor/effects.hbs',
    },
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['sidebar', 'header', 'tabs', 'biography'];
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'player':
        options.parts.push('skills', 'gear', 'magicks');
        break;
      case 'pawn':
        options.parts.push('skills', 'gear', 'magicks');
        break;
      case 'professional':
        options.parts.push('skills', 'gear', 'magicks');
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    // Output initialization
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the actor document.
      actor: this.actor,
      // Add the actor's data to context.data for easier access, as well as flags.
      system: this.actor.system,
      flags: this.actor.flags,
      // Adding a pointer to CONFIG.LORE
      config: CONFIG.LORE,
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
    };

    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'skills':
      case 'magicks':
      case 'gear':
        context.tab = context.tabs[partId];
        break;
      case 'biography':
        context.tab = context.tabs[partId];
        // Enrich biography info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          this.actor.system.biography,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.actor.getRollData(),
            // Relative UUID resolution
            relativeTo: this.actor,
          }
        );
        break;
      case 'effects':
        context.tab = context.tabs[partId];
        // Prepare active effects
        context.effects = prepareActiveEffectCategories(
          // A generator that returns all effects stored on the actor
          // as well as any items
          this.actor.allApplicableEffects()
        );
        break;
    }
    return context;
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';
    // Determine a sensible default tab based on available parts
    const candidateOrder = ['skills', 'gear', 'magicks', 'effects', 'biography'];
    if (!this.tabGroups[tabGroup]) {
      const firstAvailable = candidateOrder.find((p) => parts.includes(p));
      this.tabGroups[tabGroup] = firstAvailable ?? 'biography';
    }
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'LORE.Actor.Tabs.',
      };
      switch (partId) {
        case 'header':
        case 'tabs':
        case 'sidebar':
          return tabs;
        case 'skills':
          tab.id = 'skills';
          tab.label += 'Skills';
          break;
        case 'gear':
          tab.id = 'gear';
          tab.label += 'Gear';
          break;
        case 'magicks':
          tab.id = 'magicks';
          tab.label += 'Magicks';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          break;
          case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    // You can just use `this.document.itemTypes` instead
    // if you don't need to subdivide a given type like
    // this sheet does with magicks
  const gear = [];
  const weapons = [];
  const armor = [];
    const skills = [];
    const magicks = [];

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      // Gear is now flat; weapons are their own item type
      if (i.type === 'gear') {
        gear.push(i);
      }
      else if (i.type === 'weapon') {
        weapons.push(i);
      }
      else if (i.type === 'armor') {
        armor.push(i);
      }
      // Append to skills.
      else if (i.type === 'skill') {
        skills.push(i);
      }
      // Append to magicks.
      else if (i.type === 'magick') {
        magicks.push(i);
      }
    }

    // Sort then assign
  context.gear = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  context.weapons = weapons.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  context.armor = armor.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  // Group armor by armorType for the gear tab
  const armorByType = { head: [], body: [], arms: [], hands: [], legs: [], feet: [] };
  for (const it of context.armor) {
    const t = it?.system?.armorType;
    if (t && armorByType[t]) armorByType[t].push(it);
  }
  for (const k of Object.keys(armorByType)) {
    armorByType[k] = armorByType[k].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  context.armorByType = armorByType;
    context.skills = skills.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.magicks = magicks.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   * @override
   */
  _onRender(context, options) {
    // Ensure drag/drop is active so dropping Items/Effects onto the sheet works
    if (Array.isArray(this.#dragDrop)) {
      try {
        this.#dragDrop.forEach((d) => d.bind?.(this.element));
      } catch (e) {
        console.warn('LORE | Failed to bind drag/drop handlers on actor sheet:', e);
      }
    }

    // Close any existing context menu on re-render
    this.#closeContextMenu();

    const moraleInput = this.element.querySelector('.morale-input');
    const moraleValueEl = this.element.querySelector('.morale-value');
    if (moraleInput && moraleValueEl) {
      moraleValueEl.textContent = String(this.actor.system.morale ?? 0);
      moraleInput.addEventListener('input', (e) => {
        moraleValueEl.textContent = moraleInput.value;
      });
      moraleInput.addEventListener('change', async (e) => {
        const newMorale = Number(moraleInput.value) || 0;
        await this.actor.update({ 'system.morale': newMorale });
      });
    }

    // Context menu: right-click on attribute rows
    const attrRows = this.element.querySelectorAll('.attributes .attribute');
    for (const row of attrRows) {
      // Avoid stacking listeners by ensuring only one handler per element
      row.removeEventListener('contextmenu', this.#onAttributeContextMenuBound);
      row.addEventListener('contextmenu', this.#onAttributeContextMenuBound);
    }

    // Context menu: right-click on item rows
    const itemRows = this.element.querySelectorAll('.items-list li.item[data-document-class="Item"]');
    for (const row of itemRows) {
      row.removeEventListener('contextmenu', this.#onItemContextMenuBound);
      row.addEventListener('contextmenu', this.#onItemContextMenuBound);
    }

    // Context menu: right-click on the Skills header to create new Skill
    const skillsHeader = this.element.querySelector('.tab.skills .items-header');
    if (skillsHeader) {
      skillsHeader.removeEventListener('contextmenu', this.#onSkillsHeaderContextMenuBound);
      skillsHeader.addEventListener('contextmenu', this.#onSkillsHeaderContextMenuBound);
    }

    // Context menu: right-click on Gear tab headers to create new items
    // EXCEPTION: Disable right-click on the parent Armor list header (data-gear-type="armor")
    const gearHeaders = this.element.querySelectorAll('.tab.gear .items-header');
    for (const header of gearHeaders) {
      // Always remove our menu handler first to avoid stacking
      header.removeEventListener('contextmenu', this.#onGearHeaderContextMenuBound);

      const gearType = header?.dataset?.gearType;
      const isParentArmorHeader = gearType === 'armor';

      // Clean up any previous preventer if present
      if (header._loreCtxPrevent) {
        header.removeEventListener('contextmenu', header._loreCtxPrevent);
        header._loreCtxPrevent = null;
      }

      if (isParentArmorHeader) {
        // For the parent Armor header only, block context menu entirely
        const prevent = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        };
        header.addEventListener('contextmenu', prevent);
        // Store reference to remove cleanly on re-render
        header._loreCtxPrevent = prevent;
      } else {
        // For all other headers (weapons, gear, armor sublists), keep the menu
        header.addEventListener('contextmenu', this.#onGearHeaderContextMenuBound);
      }
    }

    // Left-click to collapse/expand any items-list; right-click remains context menu
    try {
      const headers = this.element.querySelectorAll('.items-list > li.items-header');
      for (const header of headers) {
        // Visual cue
        header.classList.add('is-collapsible');

        // Stable key to persist state
        const listKey = this.#getListKeyForHeader(header);
        if (listKey) header.dataset.listKey = listKey;

        // Apply persisted state
        const listEl = header.closest('ol.items-list');
        if (listEl && listKey && this.#collapsedLists.has(listKey)) {
          listEl.classList.add('collapsed');
        }

        // Avoid stacking listeners across renders
        if (header._loreCollapseHandler) header.removeEventListener('click', header._loreCollapseHandler);
        const collapseHandler = (e) => {
          // Only primary button; ignore clicks on interactive elements inside header
          if (e.button !== 0) return;
          if (e.target.closest('a, button, [data-action], .item-controls')) return;
          const list = header.closest('ol.items-list');
          if (!list) return;
          const key = header.dataset.listKey || this.#getListKeyForHeader(header);
          const willCollapse = !list.classList.contains('collapsed');
          list.classList.toggle('collapsed', willCollapse);
          if (key) {
            if (willCollapse) this.#collapsedLists.add(key);
            else this.#collapsedLists.delete(key);
          }
        };
        header.addEventListener('click', collapseHandler);
        header._loreCollapseHandler = collapseHandler;
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize collapsible lists:', e);
    }

    // Initialize and wire wounds checkboxes to reflect and update system.wounds.value
    const woundsValue = Number(this.actor.system?.wounds?.value ?? 0);
    const woundsMax = Number(this.actor.system?.wounds?.max ?? 3);
    const woundBoxes = this.element.querySelectorAll('input.wounds-checkbox');
    for (const cb of woundBoxes) {
      const idx = Math.max(1, Math.min(Number(cb.value) || 0, woundsMax));
      // Reflect current state
      cb.checked = idx <= woundsValue;
      // Avoid form auto-submit for these synthetic controls by stopping bubbling
      cb.removeEventListener('change', this.#onWoundsCheckboxChangeBound);
      cb.addEventListener('change', this.#onWoundsCheckboxChangeBound);
    }

    // Initialize and wire fatigue checkboxes to reflect and update system.fatigue.value
    const fatigueValue = Number(this.actor.system?.fatigue?.value ?? 0);
    const fatigueMax = Number(this.actor.system?.fatigue?.max ?? 3);
    const fatigueBoxes = this.element.querySelectorAll('input.fatigue-checkbox');
    for (const cb of fatigueBoxes) {
      const idx = Math.max(1, Math.min(Number(cb.value) || 0, fatigueMax));
      cb.checked = idx <= fatigueValue;
      cb.removeEventListener('change', this.#onFatigueCheckboxChangeBound);
      cb.addEventListener('change', this.#onFatigueCheckboxChangeBound);
    }

    // Handle nested sub-tabs inside the Gear tab (List / Paper Doll)
    try {
      const subNav = this.element.querySelector('nav.tabs.sub-tabs[data-group="gear-sub"]');
      if (subNav) {
        const group = 'gear-sub';
        // Remember selected sub-tab during this sheet's lifetime
        const current = this.tabGroups?.[group] ?? 'list';
        const sections = Array.from(this.element.querySelectorAll('.tab[data-group="gear-sub"]'));
        const links = Array.from(subNav.querySelectorAll('a.item[data-tab]'));

        const activate = (tabId) => {
          // Update stored selection
          if (this.tabGroups) this.tabGroups[group] = tabId;
          // Toggle link active state
          for (const a of links) a.classList.toggle('active', a.dataset.tab === tabId);
          // Toggle section visibility
          for (const s of sections) s.classList.toggle('active', s.dataset.tab === tabId);
        };

        // Delegate click handling; avoid stacking by removing prior handler if present
        const handler = (e) => {
          const a = e.target.closest('a.item[data-tab]');
          if (!a) return;
          e.preventDefault();
          activate(a.dataset.tab);
        };
        // Remove previous handler if we stored one on the element
        if (subNav._loreGearSubHandler) subNav.removeEventListener('click', subNav._loreGearSubHandler);
        subNav.addEventListener('click', handler);
        subNav._loreGearSubHandler = handler;

        // Ensure correct initial state each render
        activate(current);
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize Gear sub-tabs:', e);
    }

    // Initialize PRIMARY tabs (skills, gear, magicks, effects, biography)
    try {
      const primaryGroup = 'primary';
      const nav = this.element.querySelector(`nav.tabs[data-group="${primaryGroup}"]`);
      if (nav) {
        const sections = Array.from(this.element.querySelectorAll(`.tab[data-group="${primaryGroup}"]`));
        const links = Array.from(nav.querySelectorAll('a.item[data-tab]'));

        const activate = (tabId) => {
          if (this.tabGroups) this.tabGroups[primaryGroup] = tabId;
          for (const a of links) a.classList.toggle('active', a.dataset.tab === tabId);
          for (const s of sections) s.classList.toggle('active', s.dataset.tab === tabId);
        };

        // Delegate click handling; avoid stacking listeners across renders
        const handler = (e) => {
          const a = e.target.closest('a.item[data-tab]');
          if (!a) return;
          e.preventDefault();
          activate(a.dataset.tab);
        };
        if (nav._lorePrimaryHandler) nav.removeEventListener('click', nav._lorePrimaryHandler);
        nav.addEventListener('click', handler);
        nav._lorePrimaryHandler = handler;

        // Apply initial activation on each render to keep state in sync
        const current = this.tabGroups?.[primaryGroup] ?? sections[0]?.dataset?.tab ?? 'biography';
        activate(current);
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize primary tabs:', e);
    }
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } =
      this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
      {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: (path) => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    doc.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    await doc.delete();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDoc(event, target) {
    // Retrieve the configured document class for Item or ActiveEffect
    const docCls = getDocumentClass(target.dataset.documentClass);
    // Prepare the document creation data by initializing it a default name.
    let defaultName;
    if (target.dataset.documentClass === 'Item') {
      const baseType = target.dataset.type;
      if (baseType === 'weapon') defaultName = 'New Weapon';
      else if (baseType === 'gear') defaultName = 'New Gear';
    }
    const docData = {
      name:
        defaultName ??
        docCls.defaultName({
          // defaultName handles an undefined type gracefully
          type: target.dataset.type,
          parent: this.actor,
        }),
    };
    // Loop through the dataset and add it to our docData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      // These data attributes are reserved for the action handling
      if (['action', 'documentClass'].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      // An example exists in magicks.hbs, with `data-system.magick-level`
      // which turns into the dataKey 'system.magickLevel'
      foundry.utils.setProperty(docData, dataKey, value);
    }

    // Finally, create the embedded document!
    await docCls.create(docData, { parent: this.actor });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEmbeddedDocument(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Handle clickable rolls.
   *
   * @this loreActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRoll(event, target) {
    event.preventDefault();
    const dataset = target.dataset;

    // Handle item rolls.
    switch (dataset.rollType) {
      case 'item':
        const item = this._getEmbeddedDocument(target);
        if (item) return item.roll();
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      // Show a confirmation popup with roll data before executing the roll
      const label = dataset.label ?? '';
      const baseFormula = dataset.roll;
      const roll = new Roll(baseFormula, this.actor.getRollData());

      // Prepare roll data for display in the popup
      const rollData = roll.toJSON ? roll.toJSON() : { formula: baseFormula };

      const popup = new RollPopup({ rollType: 'attribute', rollData, label });
      popup.render(true);

      // Await the user's confirmation before sending the roll
      try {
        await popup.awaitConfirm();
      } catch (err) {
        // If awaiting fails or is canceled, don't proceed
        return null;
      }

      // If a modifier was provided in the popup, append it to the roll formula
      let finalRoll = roll;
      const mod = Number(popup.modifier) || 0;
      if (mod !== 0) {
        const sign = mod >= 0 ? '+' : '-';
        const abs = Math.abs(mod);
        const newFormula = `${baseFormula} ${sign} ${abs}`;
        finalRoll = new Roll(newFormula, this.actor.getRollData());
        await finalRoll.evaluate();
      }

      // Merge both rolls into a single chat card (separate displays), pawns excluded
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      let content = await finalRoll.render();
      const actorType = this.actor?.type ?? '';
      const qualifies = actorType === 'player' || actorType === 'professional';
      /** @type {Roll[]} */
      const rolls = [finalRoll];
      let loreTotal = 0;
      if (qualifies) {
        try {
          const loreRoll = new Roll('1d6');
          await loreRoll.evaluate();
          const loreHtml = await loreRoll.render();
          content += `\n<div class="lore-die">LORE Die${loreHtml}</div>`;
          rolls.push(loreRoll);
          loreTotal = Number(loreRoll.total) || 0;
        } catch (e) {
          console.warn('LORE | Failed to roll/render LORE Die for attribute:', e);
        }
      }
      // Apply Morale as a final modifier after all dice are rolled
      const morale = Number(this.actor?.system?.morale ?? 0);
      if (morale !== 0) {
        const sign = morale >= 0 ? '+' : '-';
        const abs = Math.abs(morale);
        content += `\n<div class="lore-morale-mod">Morale: ${sign}${abs}</div>`;
      }
      const finalTotal = (Number(finalRoll.total) || 0) + loreTotal + morale;
      content += `\n<div class="lore-final-total" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--color-border-light, #999);"><strong>Final Result:</strong> ${finalTotal}</div>`;
      await ChatMessage.create({
        speaker,
        flavor: label,
        rollMode,
        content,
        rolls,
      });
      return finalRoll;
    }
  }

  /** Helper Functions */

  /**
   * Fetches the embedded document representing the containing HTML element
   *
   * @param {HTMLElement} target    The element subject to search
   * @returns {Item | ActiveEffect} The embedded Item or ActiveEffect
   */
  _getEmbeddedDocument(target) {
    const docRow = target.closest('li[data-document-class]');
    if (docRow.dataset.documentClass === 'Item') {
      return this.actor.items.get(docRow.dataset.itemId);
    } else if (docRow.dataset.documentClass === 'ActiveEffect') {
      const parent =
        docRow.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(docRow?.dataset.parentId);
      return parent.effects.get(docRow?.dataset.effectId);
    } else return console.warn('Could not find document class');
  }

  /***************
   *
   * Drag and Drop
   *
   ***************/

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const docRow = event.currentTarget.closest('li');
    if ('link' in event.target.dataset) return;

    // Chained operation
    let dragData = this._getEmbeddedDocument(docRow)?.toDragData();

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call('dropActorSheetData', actor, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.actor.isOwner || !effect) return false;
    if (effect.target === this.actor)
      return this._onSortActiveEffect(event, effect);
    return aeCls.create(effect, { parent: this.actor });
  }

  /**
   * Handle a drop event for an existing embedded Active Effect to sort that Active Effect relative to its siblings
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  async _onSortActiveEffect(event, effect) {
    /** @type {HTMLElement} */
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = this._getEmbeddedDocument(dropTarget);

    // Don't sort on yourself
    if (effect.uuid === target.uuid) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (const el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      const parentId = el.dataset.parentId;
      if (
        siblingId &&
        parentId &&
        (siblingId !== effect.id || parentId !== effect.parent.id)
      )
        siblings.push(this._getEmbeddedDocument(el));
    }

    // Perform the sort
  const sortUpdates = foundry.utils.performIntegerSort(effect, {
      target,
      siblings,
    });

    // Split the updates up by parent document
    const directUpdates = [];

    const grandchildUpdateData = sortUpdates.reduce((items, u) => {
      const parentId = u.target.parent.id;
      const update = { _id: u.target.id, ...u.update };
      if (parentId === this.actor.id) {
        directUpdates.push(update);
        return items;
      }
      if (items[parentId]) items[parentId].push(update);
      else items[parentId] = [update];
      return items;
    }, {});

    // Effects-on-items updates
    for (const [itemId, updates] of Object.entries(grandchildUpdateData)) {
      await this.actor.items
        .get(itemId)
        .updateEmbeddedDocuments('ActiveEffect', updates);
    }

    // Update on the main actor
    return this.actor.updateEmbeddedDocuments('ActiveEffect', directUpdates);
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;
    const ItemCls = getDocumentClass('Item');
    const item = await ItemCls.fromDropData(data);

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid)
      return this._onSortItem(event, item);

    // Create the owned item
    return this._onDropItemCreate(item, event);
  }

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.actor.isOwner) return [];
    const FolderCls = getDocumentClass('Folder');
    const folder = await FolderCls.fromDropData(data);
    if (folder.type !== 'Item') return [];
    const droppedItemData = await Promise.all(
      folder.contents.map(async (item) => {
        if (!(document instanceof Item)) item = await fromUuid(item.uuid);
        // Always convert to source data for creation
        return item?.toObject?.() ?? item;
      })
    );
    return this._onDropItemCreate(droppedItemData, event);
  }

  /**
   * Handle the final creation of dropped Item data on the Actor.
   * This method is factored out to allow downstream classes the opportunity to override item creation behavior.
   * @param {object[]|object} itemData      The item data requested for creation
   * @param {DragEvent} event               The concluding DragEvent which provided the drop data
   * @returns {Promise<Item[]>}
   * @private
   */
  async _onDropItemCreate(itemData, event) {
    const arr = Array.isArray(itemData) ? itemData : [itemData];
    // Normalize to plain source objects
    const sources = arr.map((it) => (it?.toObject?.() ? it.toObject() : it));
    return this.actor.createEmbeddedDocuments('Item', sources);
  }

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings
   * @param {Event} event
   * @param {Item} item
   * @private
   */
  _onSortItem(event, item) {
    // Get the drag source and drop target
    const items = this.actor.items;
    const dropTarget = event.target.closest('[data-item-id]');
    if (!dropTarget) return;
    const target = items.get(dropTarget.dataset.itemId);

    // Don't sort on yourself
    if (item.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.itemId;
      if (siblingId && siblingId !== item.id)
        siblings.push(items.get(el.dataset.itemId));
    }

    // Perform the sort
  const sortUpdates = foundry.utils.performIntegerSort(item, {
      target,
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.actor.updateEmbeddedDocuments('Item', updateData);
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  // Active context menu DOM element and cleanup handlers
  #contextMenuEl = null;
  #outsidePointerHandler = null;
  #escKeyHandler = null;
  #wheelHandler = null;
  #onAttributeContextMenuBound;
  #onItemContextMenuBound;
  #onSkillsHeaderContextMenuBound;
  #onGearHeaderContextMenuBound;
  #onWoundsCheckboxChangeBound;
  #onFatigueCheckboxChangeBound;
  #collapsedLists;

  /**
   * Handle right-click on an attribute row to open a contextual menu.
   * @param {MouseEvent} event
   * @private
   */
  async #onAttributeContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    // Ensure any previous menu is closed
    this.#closeContextMenu();

    const row = event.target.closest('.attribute');
    if (!row) return;
    const attributeKey = row.dataset.attribute;

    // Define menu items; wire your real actions via data-action
    const items = [
      { action: 'roll', label: game.i18n?.localize?.('Roll') ?? 'Roll' },
    ];
    if (this.isEditable) items.push({ action: 'edit', label: game.i18n?.localize?.('Edit') ?? 'Edit' });

    // Render the menu template using namespaced API (V13+)
    let html = '';
    try {
      html = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/context-menu.hbs', { items });
    } catch (err) {
      console.error('Failed to render context menu template:', err);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const menu = wrapper.firstElementChild;
    if (!menu) return;

    // Attach behavior for clicks on menu items
    menu.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        this.#handleAttributeMenuAction(action, attributeKey, row);
      } finally {
        // Do not force-close here for actions that replace the menu content (like edit)
        if (action !== 'edit') this.#closeContextMenu();
      }
    });

    // Add to DOM first to measure
    document.body.appendChild(menu);
    // Position near cursor, clamped to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    let x = event.clientX ?? 0;
    let y = event.clientY ?? 0;
    if (x + rect.width > vw) x = Math.max(4, vw - rect.width - 4);
    if (y + rect.height > vh) y = Math.max(4, vh - rect.height - 4);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Store reference and set up dismissal behaviors
    this.#contextMenuEl = menu;
    this.#outsidePointerHandler = (e) => {
      if (!this.#contextMenuEl) return;
      if (!this.#contextMenuEl.contains(e.target)) this.#closeContextMenu();
    };
    this.#escKeyHandler = (e) => {
      if (e.key === 'Escape') this.#closeContextMenu();
    };
    this.#wheelHandler = () => this.#closeContextMenu();

    // Use capture to get the event before other handlers potentially stop it
    document.addEventListener('pointerdown', this.#outsidePointerHandler, { capture: true });
    document.addEventListener('keydown', this.#escKeyHandler, { capture: true });
    // Close on scroll/wheel to mimic native context menus
    document.addEventListener('wheel', this.#wheelHandler, { passive: true, capture: true });
  }

  /**
   * Handle right-click on an item row to open a contextual menu.
   * @param {MouseEvent} event
   * @private
   */
  async #onItemContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    // Ensure any previous menu is closed
    this.#closeContextMenu();

    const row = event.target.closest('li.item[data-document-class="Item"]');
    if (!row) return;
    const doc = this._getEmbeddedDocument(row);
    if (!doc) return;

    // Build menu items based on availability
    const items = [];
    
    items.push({ action: 'view', label: game.i18n?.localize?.('Edit') ?? 'Edit' });
    if (this.isEditable) items.push({ action: 'delete', label: game.i18n?.localize?.('Delete') ?? 'Delete' });

    // Render the menu template
    let html = '';
    try {
      html = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/context-menu.hbs', { items });
    } catch (err) {
      console.error('Failed to render context menu template:', err);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const menu = wrapper.firstElementChild;
    if (!menu) return;

    // Attach behavior for clicks on menu items
    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        await this.#handleItemMenuAction(action, row, doc);
      } finally {
        this.#closeContextMenu();
      }
    });

    // Add to DOM first to measure
    document.body.appendChild(menu);
    // Position near cursor, clamped to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    let x = event.clientX ?? 0;
    let y = event.clientY ?? 0;
    if (x + rect.width > vw) x = Math.max(4, vw - rect.width - 4);
    if (y + rect.height > vh) y = Math.max(4, vh - rect.height - 4);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Store reference and set up dismissal behaviors
    this.#contextMenuEl = menu;
    this.#outsidePointerHandler = (e) => {
      if (!this.#contextMenuEl) return;
      if (!this.#contextMenuEl.contains(e.target)) this.#closeContextMenu();
    };
    this.#escKeyHandler = (e) => {
      if (e.key === 'Escape') this.#closeContextMenu();
    };
    this.#wheelHandler = () => this.#closeContextMenu();

    document.addEventListener('pointerdown', this.#outsidePointerHandler, { capture: true });
    document.addEventListener('keydown', this.#escKeyHandler, { capture: true });
    document.addEventListener('wheel', this.#wheelHandler, { passive: true, capture: true });
  }

  /**
   * Handle right-click on the Skills list header to offer creation.
   * @param {MouseEvent} event
   * @private
   */
  async #onSkillsHeaderContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    // Ensure any previous menu is closed
    this.#closeContextMenu();

    // Only for editable sheets
    if (!this.isEditable) return;

    const items = [
      { action: 'create-skill', label: 'New Skill' }
    ];

    // Render the menu template
    let html = '';
    try {
      html = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/context-menu.hbs', { items });
    } catch (err) {
      console.error('Failed to render context menu template:', err);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const menu = wrapper.firstElementChild;
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        if (action === 'create-skill') {
          const docCls = getDocumentClass('Item');
          const name = docCls.defaultName({ type: 'skill', parent: this.actor });
          await docCls.create({ name, type: 'skill' }, { parent: this.actor });
        }
      } finally {
        this.#closeContextMenu();
      }
    });

    document.body.appendChild(menu);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    let x = event.clientX ?? 0;
    let y = event.clientY ?? 0;
    if (x + rect.width > vw) x = Math.max(4, vw - rect.width - 4);
    if (y + rect.height > vh) y = Math.max(4, vh - rect.height - 4);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    this.#contextMenuEl = menu;
    this.#outsidePointerHandler = (e) => {
      if (!this.#contextMenuEl) return;
      if (!this.#contextMenuEl.contains(e.target)) this.#closeContextMenu();
    };
    this.#escKeyHandler = (e) => { if (e.key === 'Escape') this.#closeContextMenu(); };
    this.#wheelHandler = () => this.#closeContextMenu();
    document.addEventListener('pointerdown', this.#outsidePointerHandler, { capture: true });
    document.addEventListener('keydown', this.#escKeyHandler, { capture: true });
    document.addEventListener('wheel', this.#wheelHandler, { passive: true, capture: true });
  }

  /**
   * Handle right-click on the Gear list headers to offer creation.
   * Reads data-gear-type from the header to decide what to create.
   * @param {MouseEvent} event
   * @private
   */
  async #onGearHeaderContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    // Ensure any previous menu is closed
    this.#closeContextMenu();

    // Only for editable sheets
    if (!this.isEditable) return;

  const header = event.currentTarget?.closest('.items-header');
  const gearType = header?.dataset?.gearType ?? 'gear';

    // Provide creation options; for now a single action depending on header
    let label = 'New Item';
    if (gearType === 'weapon') label = 'New Weapon';
    else if (gearType === 'armor' || (typeof gearType === 'string' && gearType.startsWith('armor'))) {
      // If creating from an armor sub-header (armor-head/body/etc.), reflect that in the label
      if (typeof gearType === 'string' && gearType.startsWith('armor-')) {
        const subtype = gearType.split('-')[1] || '';
        label = `New Armor (${subtype})`;
      } else {
        label = 'New Armor';
      }
    } else label = 'New Gear';

    const items = [ { action: 'create-gear', label } ];

    // Render the menu template
  let html = '';
    try {
      html = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/context-menu.hbs', { items });
    } catch (err) {
      console.error('Failed to render context menu template:', err);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const menu = wrapper.firstElementChild;
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        if (action === 'create-gear') {
          const docCls = getDocumentClass('Item');
          let type = 'gear';
          /** @type {Record<string, any>} */
          const createData = {};
          if (gearType === 'weapon') {
            type = 'weapon';
          } else if (gearType === 'armor' || (typeof gearType === 'string' && gearType.startsWith('armor'))) {
            type = 'armor';
            // If from an armor sub-header, set the armorType accordingly (head, body, arms, hands, legs, feet)
            if (typeof gearType === 'string' && gearType.startsWith('armor-')) {
              const subtype = gearType.split('-')[1] || '';
              // Ensure we set only recognized subtypes; otherwise omit
              const valid = ['head', 'body', 'arms', 'hands', 'legs', 'feet'];
              if (valid.includes(subtype)) {
                createData.system = { armorType: subtype };
              }
            }
          }
          const name = docCls.defaultName({ type, parent: this.actor });
          await docCls.create({ type, name, ...createData }, { parent: this.actor });
        }
      } finally {
        this.#closeContextMenu();
      }
    });

    document.body.appendChild(menu);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    let x = event.clientX ?? 0;
    let y = event.clientY ?? 0;
    if (x + rect.width > vw) x = Math.max(4, vw - rect.width - 4);
    if (y + rect.height > vh) y = Math.max(4, vh - rect.height - 4);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    this.#contextMenuEl = menu;
    this.#outsidePointerHandler = (e) => {
      if (!this.#contextMenuEl) return;
      if (!this.#contextMenuEl.contains(e.target)) this.#closeContextMenu();
    };
    this.#escKeyHandler = (e) => { if (e.key === 'Escape') this.#closeContextMenu(); };
    this.#wheelHandler = () => this.#closeContextMenu();
    document.addEventListener('pointerdown', this.#outsidePointerHandler, { capture: true });
    document.addEventListener('keydown', this.#escKeyHandler, { capture: true });
    document.addEventListener('wheel', this.#wheelHandler, { passive: true, capture: true });
  }

  /**
   * Close and cleanup the active context menu if present.
   * @private
   */
  #closeContextMenu() {
    if (this.#contextMenuEl?.parentElement) {
      this.#contextMenuEl.parentElement.removeChild(this.#contextMenuEl);
    }
    this.#contextMenuEl = null;
    if (this.#outsidePointerHandler) {
      document.removeEventListener('pointerdown', this.#outsidePointerHandler, { capture: true });
      this.#outsidePointerHandler = null;
    }
    if (this.#escKeyHandler) {
      document.removeEventListener('keydown', this.#escKeyHandler, { capture: true });
      this.#escKeyHandler = null;
    }
    if (this.#wheelHandler) {
      document.removeEventListener('wheel', this.#wheelHandler, { capture: true });
      this.#wheelHandler = null;
    }
  }

  /**
   * Handle change on wounds checkboxes, mapping to system.wounds.value
   * Prevents the default bubbling change so the form doesn't auto-submit separately.
   * @param {Event} event
   * @private
   */
  async #onWoundsCheckboxChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const input = event.currentTarget;
    const idx = Math.max(1, Number(input.value) || 1);
    const current = Number(this.actor.system?.wounds?.value ?? 0);
    const max = Number(this.actor.system?.wounds?.max ?? 3);
    let next = current;
    if (input.checked) {
      next = idx; // checking sets value to that index
    } else {
      // unchecking the highest checked index decrements by one
      next = Math.min(current, idx - 1);
    }
    next = Math.max(0, Math.min(next, max));
    if (next !== current) await this.actor.update({ 'system.wounds.value': next });
    // Update visual state immediately (the sheet will re-render after update too)
    const boxes = this.element.querySelectorAll('input.wounds-checkbox');
    for (const cb of boxes) {
      const v = Math.max(1, Number(cb.value) || 1);
      cb.checked = v <= next;
    }
  }

  /**
   * Handle change on fatigue checkboxes, mapping to system.fatigue.value
   * Prevents the default bubbling change so the form doesn't auto-submit separately.
   * @param {Event} event
   * @private
   */
  async #onFatigueCheckboxChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const input = event.currentTarget;
    const idx = Math.max(1, Number(input.value) || 1);
    const current = Number(this.actor.system?.fatigue?.value ?? 0);
    const max = Number(this.actor.system?.fatigue?.max ?? 3);
    let next = current;
    if (input.checked) {
      next = idx;
    } else {
      next = Math.min(current, idx - 1);
    }
    next = Math.max(0, Math.min(next, max));
    if (next !== current) await this.actor.update({ 'system.fatigue.value': next });
    const boxes = this.element.querySelectorAll('input.fatigue-checkbox');
    for (const cb of boxes) {
      const v = Math.max(1, Number(cb.value) || 1);
      cb.checked = v <= next;
    }
  }

  /**
   * Handle actions triggered from the attribute context menu.
   * Replace these with real behaviors as desired.
   * @param {string} action
   * @param {string} attributeKey
   * @param {HTMLElement} rowEl
   * @private
   */
  async #handleAttributeMenuAction(action, attributeKey, rowEl) {
    switch (action) {
      case 'roll': {
        // Simulate clicking the rollable label inside the row
        const rollTarget = rowEl.querySelector('.attribute-roll-label[data-action="roll"]');
        if (rollTarget) {
          // Create a synthetic click to reuse existing roll logic
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
          rollTarget.dispatchEvent(evt);
        }
        break;
      }
      case 'edit': {
        // Transform the context menu into an inline editor for the attribute rank
        this.#openAttributeEditMenu(attributeKey);
        break;
      }
      default:
        console.debug('Unhandled attribute menu action:', action, attributeKey);
    }
  }

  /**
   * Replace the current context menu content with an input to edit the attribute rank.
   * Enter saves, Escape cancels, clicking outside cancels.
   * @param {string} attributeKey
   * @private
   */
  #openAttributeEditMenu(attributeKey) {
    const menu = this.#contextMenuEl;
    if (!menu) return;

    // Get current value from the actor system
    const path = `system.attributes.${attributeKey}.value`;
    const current = Number(foundry.utils.getProperty(this.actor, path) ?? 0);

    // Clear existing content
    menu.innerHTML = '';

    // Build editor UI
  const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    wrap.style.padding = '4px 8px';

  const label = document.createElement('div');
  const attrNameKey = CONFIG?.LORE?.attributes?.[attributeKey];
  const attrName = (attrNameKey && game.i18n?.localize?.(attrNameKey)) || attributeKey;
  label.textContent = `${attrName} rank:`;
    label.style.opacity = '0.8';
    label.style.fontSize = '12px';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(current);
    input.min = '0';
    input.step = '1';
    input.style.width = '64px';
    input.style.textAlign = 'right';
  input.setAttribute('aria-label', `Edit ${attrName} rank`);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = game.i18n?.localize?.('Save') ?? 'Save';
    saveBtn.classList.add('lore-context-menu-save');

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = game.i18n?.localize?.('Cancel') ?? 'Cancel';
    cancelBtn.classList.add('lore-context-menu-cancel');

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(saveBtn);
    wrap.appendChild(cancelBtn);
    menu.appendChild(wrap);

    // Focus input ASAP
    setTimeout(() => input.focus(), 0);

    const save = async () => {
      if (!this.isEditable) { this.#closeContextMenu(); return; }
      let v = Number(input.value);
      if (!Number.isFinite(v)) v = current;
      v = Math.max(0, Math.round(v));
      await this.actor.update({ [path]: v });
      this.#closeContextMenu();
    };

    const cancel = () => this.#closeContextMenu();

    saveBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); save(); });
    cancelBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cancel(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    // Prevent clicks inside the editor from closing the menu
    menu.addEventListener('pointerdown', (e) => e.stopPropagation(), { capture: true, once: false });
  }

  /**
   * Execute selected item context-menu action.
   * @param {string} action
   * @param {HTMLElement} rowEl The LI element for the item row
   * @param {Item} doc The embedded item document
   * @private
   */
  async #handleItemMenuAction(action, rowEl, doc) {
    switch (action) {
      case 'roll': {
        // Prefer clicking the existing rollable anchor to reuse logic
        const rollTarget = rowEl.querySelector('.rollable[data-action="roll"]');
        if (rollTarget) {
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
          rollTarget.dispatchEvent(evt);
        } else if (doc?.roll) {
          try { await doc.roll(); } catch (e) { console.error(e); }
        }
        break;
      }
      case 'view': {
        doc?.sheet?.render(true);
        break;
      }
      case 'delete': {
        if (!this.isEditable) return;
        await doc?.delete();
        break;
      }
      default:
        console.debug('Unhandled item menu action:', action, doc);
    }
  }

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      // Use DragDrop directly; using .implementation prevents handlers from binding on some versions
      return new foundry.applications.ux.DragDrop(d);
    });
  }

  /********************
   *
   * Actor Override Handling
   *
   ********************/

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used for a document update
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  async _processSubmitData(event, form, submitData) {
    const overrides = foundry.utils.flattenObject(this.actor.overrides);
    for (let k of Object.keys(overrides)) delete submitData[k];
    await this.document.update(submitData);
  }

  /**
   * Compute a stable key for a list header to persist collapse state during this sheet's lifetime.
   * Keys are shaped like `${tabId}:${sub}` where sub identifies multiple lists in a tab.
   * @param {HTMLElement} header
   * @returns {string}
   * @private
   */
  #getListKeyForHeader(header) {
    try {
      const tabEl = header.closest('.tab');
      const tabId = tabEl?.dataset?.tab || 'unknown';
      let sub = 'list';
      if (tabId === 'gear') {
        sub = header.dataset?.gearType || 'gear';
      } else if (tabId === 'skills') {
        sub = 'skills';
      } else if (tabId === 'magicks') {
        sub = 'magicks';
      }
      return `${tabId}:${sub}`;
    } catch (e) {
      return 'unknown:list';
    }
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    const flatOverrides = foundry.utils.flattenObject(this.actor.overrides);
    for (const override of Object.keys(flatOverrides)) {
      const input = this.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
      }
    }
  }
}

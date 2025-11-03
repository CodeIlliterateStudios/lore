
const { api, sheets } = foundry.applications;
import { RollPopup } from "../apps/roll-popup.mjs";
import { RollHandler } from "../helpers/roll-handler.mjs";
import { LoreContextMenus } from "../helpers/context-menu.mjs";
import { LoreTabNavigation } from "../helpers/tab-navigation.mjs";
import { LoreWoundsFatigue } from "../helpers/wounds-fatigue.mjs";
import { LoreMorale } from "../helpers/morale.mjs";
import { prepareActiveEffectCategories } from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class loreActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
  
  constructor(options = {}) {
    super(options);
    this._dragDrop = this.#createDragDropHandlers();
    // Context menu controller
    this._contextMenus = new LoreContextMenus(this);
    // Wounds & Fatigue controller
    this._woundsFatigue = new LoreWoundsFatigue(this);
    // Tab navigation controller
    this._tabNavigation = new LoreTabNavigation(this);
    // Morale slider controller
    this._morale = new LoreMorale(this);

    // No-op: actions are wired via DEFAULT_OPTIONS.actions
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['lore', 'actor'],
    position: {
      width: 700,
      height: 700,
    },
    actions: {
      onEditImage: this._onEditImage,
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      roll: this._onRoll,
      // Handle left-click on one-handed weapon equip control
      'weapon-equip-context': this._onWeaponEquipContext,
      // Clear ancestry slot
      'clear-ancestry': this._onClearAncestry,
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
        options.parts.push('skills', 'gear');
        if (this.#hasMagicksBackgroundBoon()) options.parts.push('magicks');
        break;
      case 'lackey':
        options.parts.push('skills', 'gear');
        if (this.#hasMagicksBackgroundBoon()) options.parts.push('magicks');
        break;
      case 'pawn':
        options.parts.push('skills', 'gear');
        if (this.#hasMagicksBackgroundBoon()) options.parts.push('magicks');
        break;
      case 'legend':
        options.parts.push('skills', 'gear');
        if (this.#hasMagicksBackgroundBoon()) options.parts.push('magicks');
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

    // Prepare dynamic slot arrays for wounds and fatigue based on actor max values
    try {
      const woundsMax = Math.max(0, Number(this.actor.system?.wounds?.max ?? 0));
      const fatigueMax = Math.max(0, Number(this.actor.system?.fatigue?.max ?? 0));
      context.woundSlots = Array.from({ length: woundsMax }, (_, i) => i + 1);
      context.fatigueSlots = Array.from({ length: fatigueMax }, (_, i) => i + 1);
    } catch (e) {
      console.warn('LORE | Failed preparing wound/fatigue slots', e);
      context.woundSlots = [1, 2, 3];
      context.fatigueSlots = [1, 2, 3];
    }

  // Prepare equipped items for paper doll and armor summary
    const equipped = {};
    const eqArmor = this.actor.system?.equippedArmor || {};
    const eqWeapons = this.actor.system?.equippedWeapons || {};
  const eqAncestryId = this.actor.system?.equippedAncestry || '';

    // Start with any explicit equipped IDs stored on the actor (if used)
    for (const slot of ["head","body","arms","hands","legs","feet"]) {
      const id = eqArmor[slot];
      equipped[slot] = id ? this.actor.items.get(id) : null;
    }

    // Override with items that have the equipped flag set for their armorType
    // If multiple are equipped for the same slot, prefer highest armorValue
    const armorItems = this.actor.items.filter(i => i.type === 'armor' && i.system?.equipped);
    for (const slot of ["head","body","arms","hands","legs","feet"]) {
      const choices = armorItems.filter(i => i.system?.armorType === slot);
      if (choices.length > 0) {
        choices.sort((a,b) => (b.system?.armorValue ?? 0) - (a.system?.armorValue ?? 0));
        equipped[slot] = choices[0];
      }
    }

    // Weapons: keep existing mapping
    for (const slot of ["mainhand","offhand"]) {
      const id = eqWeapons[slot];
      equipped[slot] = id ? this.actor.items.get(id) : null;
    }
  // Ancestry: show only the explicitly mapped ancestry item
  equipped.ancestry = eqAncestryId ? this.actor.items.get(eqAncestryId) : null;
    context.equipped = equipped;

    // Compute armor summary values per slot (fallback to 0 if empty)
    context.armorSummary = {
      head: equipped.head?.system?.armorValue ?? 0,
      body: equipped.body?.system?.armorValue ?? 0,
      arms: equipped.arms?.system?.armorValue ?? 0,
      hands: equipped.hands?.system?.armorValue ?? 0,
      legs: equipped.legs?.system?.armorValue ?? 0,
      feet: equipped.feet?.system?.armorValue ?? 0,
    };

    return context;
  }

  /**
   * Determine whether the actor should display the Magicks tab.
   * The tab is shown only if the actor has at least one Boon item
   * with the "magicks background" checkbox enabled.
   * @returns {boolean}
   */
  #hasMagicksBackgroundBoon() {
    try {
      return this.document.items.some(
        (i) => i.type === 'boon' && i.system?.magicksBackground === true
      );
    } catch (e) {
      console.warn('LORE | Failed checking magicks background boon', e);
      return false;
    }
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
        // Compute which biography fields should be visible based on equipped ancestry
        try {
          const ancestry = context?.equipped?.ancestry ?? null;
          const bf = ancestry?.system?.bioFields ?? {};
          context.bioVisibility = {
            gender: ancestry ? (bf.gender ?? true) : true,
            age: ancestry ? (bf.age ?? true) : true,
            height: ancestry ? (bf.height ?? true) : true,
            weight: ancestry ? (bf.weight ?? true) : true,
          };
        } catch (e) {
          console.warn('LORE | Failed computing biography field visibility', e);
          context.bioVisibility = { gender: true, age: true, height: true, weight: true };
        }
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
    
    const firstAvailable = candidateOrder.find((p) => parts.includes(p));
    const current = this.tabGroups[tabGroup];
    // Initialize or correct the current tab if it's missing from available parts
    if (!current || !parts.includes(current)) {
      this.tabGroups[tabGroup] = firstAvailable ?? 'biography';
    }
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        id: '',
        icon: '',
        label: 'LORE.Actor.Tabs.',
      };
      switch (partId) {
        case 'header':
        case 'tabs':
        case 'sidebar':
          return tabs;
        case 'skills':
          tab.id = 'skills';
          tab.label += 'Details';
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
    const boons = [];
    const banes = [];

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
      else if (i.type === 'boon') {
        boons.push(i);
      }
      else if (i.type === 'bane') {
        banes.push(i);
      }
    }

    // Sort then assign
    context.gear = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.weapons = weapons.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    // Compute display attack modifier for each weapon row
    try {
      const migMod = Number(this.actor.system?.attributes?.mig?.mod ?? 0) || 0;
      for (const w of context.weapons) {
        const isRanged = (w.system?.weaponType === 'ranged');
        // Show only Might modifier for melee; ranged shows nothing in the template
        const total = isRanged ? 0 : migMod;
        w.displayAttackMod = total;
        w.displayAttackModSigned = `${total >= 0 ? '+' : ''}${total}`;
      }
    } catch (e) {
      console.warn('LORE | Failed computing weapon display modifiers', e);
    }
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
    context.boons = boons.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.banes = banes.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Lore Coins UI context (players and legends only) - fixed 5-slot display
    try {
      context.showLoreCoins = ['player', 'legend'].includes(this.document.type);
      const lc = Number(this.actor.system?.loreCoin ?? 0);
      const loreCoinCount = isNaN(lc) ? 0 : Math.max(0, lc);
      const maxSlots = 5;
      context.loreCoinSlots = Array.from({ length: maxSlots }, (_, i) => ({
        idx: i + 1,
        filled: i < loreCoinCount,
      }));
    } catch (e) {
      context.showLoreCoins = false;
      context.loreCoinSlots = [];
    }
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
    if (Array.isArray(this._dragDrop)) {
      try {
        this._dragDrop.forEach((d) => d.bind?.(this.element));
      } catch (e) {
        console.warn('LORE | Failed to bind drag/drop handlers on actor sheet:', e);
      }
    }

    // Close any existing context menu on re-render and re-bind
    this._contextMenus.close();

    // Initialize and wire morale slider/value
    this._morale.attach(this.element);

    // Delegate all context menu bindings to the controller
    this._contextMenus.attach(this.element);
    // Initialize and wire wounds & fatigue checkboxes
    this._woundsFatigue.attach(this.element);

    // Add click handler for weapon skill rolls in gear list
    const weaponSkillLinks = this.element.querySelectorAll('.weapon-skill-roll');
    for (const link of weaponSkillLinks) {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const itemId = link.dataset.itemId;
        const weaponType = link.dataset.weaponType;
        // Find the correct skill name
  let skillName = weaponType === 'ranged' ? 'shooting' : 'brawling';
        // Try to find the skill item on the actor
        let skillItem = this.actor.items.find(i => i.type === 'skill' && i.name.toLowerCase() === skillName);
        // If not found, fall back to untrained
        if (!skillItem) {
          skillName = 'untrained';
          skillItem = this.actor.items.find(i => i.type === 'skill' && i.name.toLowerCase() === 'untrained');
        }
        if (skillItem && skillItem.roll) {
          // Use the same roll popup as other rolls
          await skillItem.roll();
        } else {
          ui.notifications?.warn(`No skill found for ${skillName}`);
        }
      });
    }
    // Handle armor equip checkboxes in gear list (one per slot)
    const armorEquipInputs = this.element.querySelectorAll('.items-armor-sub input[name="system.equipped"]');
    for (const input of armorEquipInputs) {
      input.addEventListener('change', async (event) => {
        // Prevent the sheet's submit-on-change from racing; we'll update directly
        event.stopPropagation();
        event.preventDefault();
        try {
          const li = input.closest('li[data-item-id]');
          const itemId = input.dataset.itemId || li?.dataset.itemId;
          const item = itemId ? this.actor.items.get(itemId) : null;
          if (!item) return;
          await item.update({ 'system.equipped': input.checked });
        } catch (e) {
          console.warn('LORE | Failed to toggle armor equipped state', e);
        }
      });
    }

    // Handle two-handed weapon equip checkboxes in weapon list
    const weaponEquipInputs = this.element.querySelectorAll('.items-weapons input[name="system.equipped"]');
    for (const input of weaponEquipInputs) {
      const li = input.closest('li.item[data-item-id]');
      const itemId = li?.dataset?.itemId;
      const item = itemId ? this.actor.items.get(itemId) : null;
      if (!item || item.type !== 'weapon') continue;
      const handed = item.system?.handedness;
      if (handed !== 'two') continue; // Only intercept two-handed weapon checkboxes

      input.addEventListener('change', async (event) => {
        // Intercept default submit and handle custom equip logic
        event.stopPropagation();
        event.preventDefault();
        try {
          const checked = input.checked === true;
          const actor = this.actor;
          const slots = actor.system?.equippedWeapons || {};

          if (checked) {
            // If equipping a two-handed weapon: clear both slots of any other items first
            const prevMain = slots.mainhand && slots.mainhand !== item.id ? this.actor.items.get(slots.mainhand) : null;
            const prevOff = slots.offhand && slots.offhand !== item.id ? this.actor.items.get(slots.offhand) : null;
            try { await prevMain?.update?.({ 'system.equipped': false }); } catch (e) {}
            try { await prevOff?.update?.({ 'system.equipped': false }); } catch (e) {}

            // Equip this weapon to both hands
            await actor.update({
              'system.equippedWeapons.mainhand': item.id,
              'system.equippedWeapons.offhand': item.id,
            });
            await item.update({ 'system.equipped': true });
            // Ensure immediate visual state reflects the change before re-render
            input.checked = true;
          } else {
            // Unchecking: if this item occupies either slot, clear both; mark it unequipped
            const updates = {};
            if (slots.mainhand === item.id) updates['system.equippedWeapons.mainhand'] = null;
            if (slots.offhand === item.id) updates['system.equippedWeapons.offhand'] = null;
            if (Object.keys(updates).length) await actor.update(updates);
            await item.update({ 'system.equipped': false });
            // Ensure immediate visual state reflects the change before re-render
            input.checked = false;
          }
        } catch (e) {
          console.warn('LORE | Failed to toggle two-handed weapon equipped state', e);
        }
      });
    }
    // Attach tab navigation (primary + gear sub-tabs)
    this._tabNavigation.attach(this.element);

    // Lore Coins click handlers (left click: use/decrement, right click: add/increment)
    try {
      if (['player', 'legend'].includes(this.document.type)) {
        const coinBox = this.element.querySelector('.lore-coin-box');
        if (coinBox) {
          coinBox.addEventListener('click', async (event) => {
            event.preventDefault();
            const current = Number(this.actor.system?.loreCoin ?? 0) || 0;
            const next = Math.max(0, current - 1);
            if (next !== current) await this.actor.update({ 'system.loreCoin': next });
          });
          coinBox.addEventListener('contextmenu', async (event) => {
            event.preventDefault();
            const current = Number(this.actor.system?.loreCoin ?? 0) || 0;
            const next = current + 1;
            await this.actor.update({ 'system.loreCoin': next });
          });
        }
      }
    } catch (e) {
      console.warn('LORE | Failed binding lore coin handlers', e);
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
    // Prevent anchor default navigation (which can open a new tab/window depending on the environment)
    try { event?.preventDefault?.(); } catch (e) {}
    try {
      // Stop propagation so no outer handlers or default behaviors interfere
      event?.stopPropagation?.();
      if (event?.stopImmediatePropagation) event.stopImmediatePropagation();
    } catch (e) {}
    const doc = this._getEmbeddedDocument(target);
    doc?.sheet?.render?.(true);
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

    // Handle rolls that supply the formula directly via the centralized handler.
    if (dataset.roll) {
      const label = dataset.label ?? '';
      return await RollHandler.rollInline({ actor: this.actor, formula: dataset.roll, label });
    }
  }

  /**
   * Handle opening the context menu for one-handed weapon equipping.
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static _onWeaponEquipContext(event, target) {
    // The `actions` framework in ApplicationV2 is based on click events.
    // We'll prevent the default behavior and pass the event to our dedicated context menu handler.
    event.preventDefault();

    // Delegate to the context menu controller
    this._contextMenus.onWeaponEquipClick(event, target);
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
    
    // Special handling: ancestry item occupies a single slot on the actor
    if (item?.type === 'ancestry') {
      let embedded = item;
      // If not already on this actor, create it first
      if (this.actor.uuid !== item.parent?.uuid) {
        const source = item.toObject?.() ?? item;
        const created = await this.actor.createEmbeddedDocuments('Item', [source]);
        embedded = created && created[0] ? this.actor.items.get(created[0]._id ?? created[0].id) : null;
      }
      if (!embedded) return false;
      // Map ancestry slot to this item ID
      await this.actor.update({ 'system.equippedAncestry': embedded.id });
      return [embedded];
    }

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid)
      return this._onSortItem(event, item);

    // Create the owned item (default behavior)
    return this._onDropItemCreate(item, event);
  }

  /**
   * Clear the ancestry slot mapping on the actor.
   */
  static async _onClearAncestry(event, target) {
    event.preventDefault();
    await this.actor.update({ 'system.equippedAncestry': '' });
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

  /**
   * Handle actions triggered from the attribute context menu.
   * Replace these with real behaviors as desired.
   * @param {string} action
   * @param {string} attributeKey
   * @param {HTMLElement} rowEl
   * @private
   */
  

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

/**
 * LoreContextMenus encapsulates all context menu handling for the Lore actor sheet.
 * It wires listeners on render and handles building, positioning, and dismissing menus.
 */
export class LoreContextMenus {
  /**
   * @param {import('../sheets/actor-sheet.mjs').loreActorSheet} sheet
   */
  constructor(sheet) {
    this.sheet = sheet;
    /** @type {HTMLElement|null} */
    this.rootEl = null;
    /** @type {HTMLElement|null} */
    this._menuEl = null;
    this._outsidePointerHandler = null;
    this._escKeyHandler = null;
    this._wheelHandler = null;

    // Stable bound handlers to allow proper removeEventListener
    this._onAttributeContextMenuBound = this._onAttributeContextMenu.bind(this);
    this._onItemContextMenuBound = this._onItemContextMenu.bind(this);
    this._onSkillsHeaderContextMenuBound = this._onSkillsHeaderContextMenu.bind(this);
    this._onGearHeaderContextMenuBound = this._onGearHeaderContextMenu.bind(this);
  }

  /**
   * Bind contextmenu listeners to the current sheet element. Safe to call on every render.
   * @param {HTMLElement} rootEl
   */
  attach(rootEl) {
    this.rootEl = rootEl;

    // Attribute rows
    const attrRows = rootEl.querySelectorAll('.attributes .attribute');
    for (const row of attrRows) {
      row.removeEventListener('contextmenu', this._onAttributeContextMenuBound);
      row.addEventListener('contextmenu', this._onAttributeContextMenuBound);
    }

    // Item rows
    const itemRows = rootEl.querySelectorAll('.items-list li.item[data-document-class="Item"]');
    for (const row of itemRows) {
      row.removeEventListener('contextmenu', this._onItemContextMenuBound);
      row.addEventListener('contextmenu', this._onItemContextMenuBound);
    }

    // Skills header
    const skillsHeader = rootEl.querySelector('.tab.skills .items-header');
    if (skillsHeader) {
      skillsHeader.removeEventListener('contextmenu', this._onSkillsHeaderContextMenuBound);
      skillsHeader.addEventListener('contextmenu', this._onSkillsHeaderContextMenuBound);
    }

    // Gear headers (main + sub-headers); skip main armor header
    const gearHeaders = rootEl.querySelectorAll('.tab.gear .items-header, .tab.gear .items-sub-header');
    for (const header of gearHeaders) {
      if (header.classList.contains('items-header') && header.dataset.gearType === 'armor') continue;
      header.removeEventListener('contextmenu', this._onGearHeaderContextMenuBound);
      header.addEventListener('contextmenu', this._onGearHeaderContextMenuBound);
    }
  }

  /** Close any open menu and remove global listeners */
  close() {
    if (this._menuEl?.parentElement) {
      this._menuEl.parentElement.removeChild(this._menuEl);
    }
    this._menuEl = null;
    if (this._outsidePointerHandler) {
      document.removeEventListener('pointerdown', this._outsidePointerHandler, { capture: true });
      this._outsidePointerHandler = null;
    }
    if (this._escKeyHandler) {
      document.removeEventListener('keydown', this._escKeyHandler, { capture: true });
      this._escKeyHandler = null;
    }
    if (this._wheelHandler) {
      document.removeEventListener('wheel', this._wheelHandler, { capture: true });
      this._wheelHandler = null;
    }
  }

  /**
   * Right-click on attribute row
   * @param {MouseEvent} event
   */
  async _onAttributeContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    this.close();

    const row = event.target.closest('.attribute');
    if (!row) return;
    const attributeKey = row.dataset.attribute;

    const items = [
      { action: 'roll', label: game.i18n?.localize?.('Roll') ?? 'Roll' },
    ];
    if (this.sheet.isEditable) items.push({ action: 'edit', label: game.i18n?.localize?.('Edit') ?? 'Edit' });

    const menu = await this._renderMenu(items);
    if (!menu) return;

    menu.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        this._handleAttributeMenuAction(action, attributeKey, row);
      } finally {
        if (action !== 'edit') this.close();
      }
    });

    this._positionAndOpen(menu, event);
  }

  /**
   * Right-click on item row
   * @param {MouseEvent} event
   */
  async _onItemContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    this.close();

    const row = event.target.closest('li.item[data-document-class="Item"]');
    if (!row) return;
    const doc = this.sheet._getEmbeddedDocument(row);
    if (!doc) return;

    const items = [];
    items.push({ action: 'view', label: game.i18n?.localize?.('Edit') ?? 'Edit' });
    if (this.sheet.isEditable) items.push({ action: 'delete', label: game.i18n?.localize?.('Delete') ?? 'Delete' });

    const menu = await this._renderMenu(items);
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        await this._handleItemMenuAction(action, row, doc);
      } finally {
        this.close();
      }
    });

    this._positionAndOpen(menu, event);
  }

  /**
   * Right-click on skills header
   * @param {MouseEvent} event
   */
  async _onSkillsHeaderContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    this.close();

    if (!this.sheet.isEditable) return;

    const items = [ { action: 'create-skill', label: 'New Skill' } ];
    const menu = await this._renderMenu(items);
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        if (action === 'create-skill') {
          const docCls = getDocumentClass('Item');
          const name = docCls.defaultName({ type: 'skill', parent: this.sheet.actor });
          await docCls.create({ name, type: 'skill' }, { parent: this.sheet.actor });
        }
      } finally {
        this.close();
      }
    });

    this._positionAndOpen(menu, event);
  }

  /**
   * Right-click on gear headers
   * @param {MouseEvent} event
   */
  async _onGearHeaderContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    this.close();

    if (!this.sheet.isEditable) return;

    let header = event.currentTarget;
    if (!header.classList.contains('items-header') && !header.classList.contains('items-sub-header')) {
      header = header.closest('.items-header, .items-sub-header');
    }
    const gearType = header?.dataset?.gearType ?? 'gear';

    let label = 'New Item';
    if (gearType === 'weapon') label = 'New Weapon';
    else if (gearType === 'armor' || (typeof gearType === 'string' && gearType.startsWith('armor'))) {
      if (typeof gearType === 'string' && gearType.startsWith('armor-')) {
        const subtype = gearType.split('-')[1] || '';
        label = `New Armor (${subtype})`;
      } else {
        label = 'New Armor';
      }
    } else label = 'New Gear';

    const items = [ { action: 'create-gear', label } ];
    const menu = await this._renderMenu(items);
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.lore-context-menu-item');
      if (!itemEl) return;
      const action = itemEl.dataset.action;
      try {
        if (action === 'create-gear') {
          const docCls = getDocumentClass('Item');
          let type = 'gear';
          const createData = {};
          let armorType = undefined;
          if (gearType === 'weapon') {
            type = 'weapon';
          } else if (gearType === 'armor' || (typeof gearType === 'string' && gearType.startsWith('armor'))) {
            type = 'armor';
            if (typeof gearType === 'string' && gearType.startsWith('armor-')) {
              const subtype = gearType.split('-')[1] || '';
              const valid = ['head', 'body', 'arms', 'hands', 'legs', 'feet'];
              if (valid.includes(subtype)) {
                createData.system = { armorType: subtype };
                armorType = subtype;
              }
            }
          }
          let name = docCls.defaultName({ type, parent: this.sheet.actor });
          if (type === 'armor' && armorType) {
            name = armorType.charAt(0).toUpperCase() + armorType.slice(1);
          }
          await docCls.create({ type, name, ...createData }, { parent: this.sheet.actor });
        }
      } finally {
        this.close();
      }
    });

    this._positionAndOpen(menu, event);
  }

  /** Render the menu template */
  async _renderMenu(items) {
    try {
      const html = await foundry.applications.handlebars.renderTemplate('systems/lore/templates/context-menu.hbs', { items });
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      return wrapper.firstElementChild;
    } catch (err) {
      console.error('Failed to render context menu template:', err);
      return null;
    }
  }

  /** Position near cursor and register dismissal */
  _positionAndOpen(menu, event) {
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

    this._menuEl = menu;
    this._outsidePointerHandler = (e) => {
      if (!this._menuEl) return;
      if (!this._menuEl.contains(e.target)) this.close();
    };
    this._escKeyHandler = (e) => { if (e.key === 'Escape') this.close(); };
    this._wheelHandler = () => this.close();

    setTimeout(() => {
      document.addEventListener('pointerdown', this._outsidePointerHandler, { capture: true });
    }, 0);
    document.addEventListener('keydown', this._escKeyHandler, { capture: true });
    document.addEventListener('wheel', this._wheelHandler, { passive: true, capture: true });
  }

  /** Attribute menu actions */
  async _handleAttributeMenuAction(action, attributeKey, rowEl) {
    switch (action) {
      case 'roll': {
        const rollTarget = rowEl.querySelector('.attribute-roll-label[data-action="roll"]');
        if (rollTarget) {
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
          rollTarget.dispatchEvent(evt);
        }
        break;
      }
      case 'edit': {
        this._openAttributeEditMenu(attributeKey);
        break;
      }
      default:
        console.debug('Unhandled attribute menu action:', action, attributeKey);
    }
  }

  /** Inline editor for attribute rank */
  _openAttributeEditMenu(attributeKey) {
    const menu = this._menuEl;
    if (!menu) return;

    const path = `system.attributes.${attributeKey}.value`;
    const current = Number(foundry.utils.getProperty(this.sheet.actor, path) ?? 0);

    menu.innerHTML = '';

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

    setTimeout(() => input.focus(), 0);

    const save = async () => {
      if (!this.sheet.isEditable) { this.close(); return; }
      let v = Number(input.value);
      if (!Number.isFinite(v)) v = current;
      v = Math.max(0, Math.round(v));
      await this.sheet.actor.update({ [path]: v });
      this.close();
    };

    const cancel = () => this.close();

    saveBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); save(); });
    cancelBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cancel(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    menu.addEventListener('pointerdown', (e) => e.stopPropagation(), { capture: true, once: false });
  }

  /** Item menu actions */
  async _handleItemMenuAction(action, rowEl, doc) {
    switch (action) {
      case 'roll': {
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
        if (!this.sheet.isEditable) return;
        await doc?.delete();
        break;
      }
      default:
        console.debug('Unhandled item menu action:', action, doc);
    }
  }
}

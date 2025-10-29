// Import document classes.
import { loreActor } from './documents/actor.mjs';
import { loreItem } from './documents/item.mjs';
// Import sheet classes.
import { loreActorSheet } from './sheets/actor-sheet.mjs';
import { loreItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { LORE } from './helpers/config.mjs';
import './helpers/chat.mjs';
import { registerSystemSettings } from './helpers/settings.mjs';
import { RollHandler } from './helpers/roll-handler.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// Add key classes to the global scope so they can be more easily used
// by downstream developers
globalThis.lore = {
  documents: {
    loreActor,
    loreItem,
  },
  applications: {
    loreActorSheet,
    loreItemSheet,
  },
  utils: {
    rollItemMacro,
  },
  models,
};

Hooks.once('init', function () {
  // Add custom constants for configuration.
  CONFIG.LORE = LORE;

  // Register system settings
  registerSystemSettings();

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '(@attributes.ref.value)d6khx + @attributes.ref.mod',
    decimals: 2,
  };

  CONFIG.Actor.documentClass = loreActor;
  CONFIG.Actor.dataModels = {
    player: models.lorePlayer,
    lackey: models.loreLackey,
    legend: models.loreLegend,
  };
  
  CONFIG.Item.documentClass = loreItem;
  CONFIG.Item.dataModels = {
    gear: models.loreGear,
    weapon: models.loreWeapon,
    skill: models.loreSkill,
    magick: models.loreMagick,
    armor: models.loreArmor,
    boon: models.loreBoon,
    bane: models.loreBane,
  };
 

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes after confirming existence
  if (loreActorSheet && loreItemSheet) {
    try {
      const ActorsColl = foundry.documents?.collections?.Actors ?? Actors;
      const ItemsColl = foundry.documents?.collections?.Items ?? Items;
      const CoreActorSheetV1 = foundry.appv1?.sheets?.ActorSheet;
      const CoreItemSheetV1 = foundry.appv1?.sheets?.ItemSheet;
      // Best-effort unregister of the core sheets if available
      if (ActorsColl && CoreActorSheetV1) {
        try { ActorsColl.unregisterSheet('core', CoreActorSheetV1); } catch {}
      }
      if (ItemsColl && CoreItemSheetV1) {
        try { ItemsColl.unregisterSheet('core', CoreItemSheetV1); } catch {}
      }
      // Register V2 sheets as default for our system
      ActorsColl?.registerSheet?.('lore', loreActorSheet, {
        makeDefault: true,
        label: 'LORE.SheetLabels.Actor',
        types: game.system?.documentTypes?.Actor ?? Object.keys(CONFIG.Actor.dataModels ?? {}),
      });
      ItemsColl?.registerSheet?.('lore', loreItemSheet, {
        makeDefault: true,
        label: 'LORE.SheetLabels.Item',
        types: game.system?.documentTypes?.Item ?? Object.keys(CONFIG.Item.dataModels ?? {}),
      });
    } catch (e) {
      console.error('Lore | Failed to register sheets:', e);
    }
  } else {
    console.error('Lore sheet classes not found for registration.');
  }
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */


// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

// Register a 'range' helper for looping in templates
// Register a safe JSONstringify helper for roll-popup and other templates
Handlebars.registerHelper('JSONstringify', function(context) {
  try {
    return JSON.stringify(context, null, 2);
  } catch (e) {
    return '';
  }
});
Handlebars.registerHelper('range', function (start, end) {
  let arr = [];
  for (let i = start; i < end; i++) arr.push(i);
  return arr;
});



/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Preload system templates that we render dynamically (performance)
  try {
    const load = foundry?.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
    if (typeof load === 'function') {
      load([
        'systems/lore/templates/chat/message.hbs',
        'systems/lore/templates/components/hotbar-target-number.hbs',
      ]);
    } else {
      console.warn('Lore | No Handlebars template loader available. Skipping template preload.');
    }
  } catch (e) {
    console.warn('Lore | Failed to preload templates', e);
  }
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));

  // Function to show/hide the default background based on scene state
  function updateDefaultBackground() {
    const hasActiveScene = !!game.scenes?.active;
    const bg = document.getElementById('lore-default-background');
    if (!hasActiveScene) {
      if (!bg) {
        const newBg = document.createElement('div');
        newBg.id = 'lore-default-background';
        newBg.className = 'lore-default-background';
        document.body.appendChild(newBg);
      }
    } else {
      if (bg) bg.remove();
    }
  }

  // Initial check on ready
  updateDefaultBackground();

  // Settings template is currently non-functional; no client effects to apply

  // Listen for scene activation/deactivation
  Hooks.on('canvasReady', updateDefaultBackground);
  Hooks.on('updateScene', updateDefaultBackground);
  Hooks.on('createScene', updateDefaultBackground);
  Hooks.on('deleteScene', updateDefaultBackground);

  // Insert and maintain the global Target Number (TN) widget near the hotbar
  // Use the registered setting key 'targetNumberValue' consistently across the system
  const getDV = () => Math.max(0, Number(game.settings.get('lore', 'targetNumberValue') || 0));
  const setDV = (v) => game.user.isGM && game.settings.set('lore', 'targetNumberValue', Math.max(0, Number(v) || 0));

  async function ensureDVWidget() {
    let el = document.getElementById('lore-dv-widget');
    if (!el) {
      try {
        const tplPath = 'systems/lore/templates/components/hotbar-target-number.hbs';
        const compiled = await foundry.applications.handlebars.renderTemplate(tplPath, {
          value: Math.max(0, Number(game.settings.get('lore', 'targetNumberValue') || 0)),
          isGM: !!game.user?.isGM,
        });
        const tmp = document.createElement('div');
        tmp.innerHTML = compiled.trim();
        el = tmp.firstElementChild;
        if (el) document.body.appendChild(el);
      } catch (e) {
        console.error('Lore | Failed to render hotbar-target-number.hbs, falling back to DOM creation', e);
        el = document.createElement('div');
        el.id = 'lore-dv-widget';
        el.className = 'lore-dv-widget';
        el.innerHTML = `
          <button class="dv-btn dv-dec" title="Decrease Target Number" aria-label="Decrease">\u25BC</button>
          <span class="dv-label">TN</span>
          <span class="dv-value">0</span>
          <button class="dv-btn dv-inc" title="Increase Target Number" aria-label="Increase">\u25B2</button>
        `;
        document.body.appendChild(el);
      }

      // Events
      const dec = el.querySelector('.dv-dec');
      const inc = el.querySelector('.dv-inc');
      dec?.addEventListener('click', () => {
        if (!game.user.isGM) return;
        const curr = getDV();
        setDV(Math.max(0, curr - 1));
        updateDVWidget();
      });
      inc?.addEventListener('click', () => {
        if (!game.user.isGM) return;
        const curr = getDV();
        setDV(curr + 1);
        updateDVWidget();
      });
    }
    updateDVWidget();
    positionDVWidget();
    return el;
  }

  function updateDVWidget() {
    const el = document.getElementById('lore-dv-widget');
    if (!el) return;
    const valEl = el.querySelector('.dv-value');
    const dec = el.querySelector('.dv-dec');
    const inc = el.querySelector('.dv-inc');
    const dv = getDV();
    if (valEl) valEl.textContent = String(dv > 0 ? dv : 0);
    const gm = !!game.user?.isGM;
    [dec, inc].forEach(btn => {
      if (!btn) return;
      btn.disabled = !gm;
      btn.setAttribute('aria-disabled', String(!gm));
    });
    // Set a class to visually indicate non-GM users (buttons appear disabled)
    el.classList.toggle('is-gm', gm);
  }

  function positionDVWidget() {
    const el = document.getElementById('lore-dv-widget');
    const hb = document.getElementById('hotbar');
    if (!el || !hb) return;
    try {
      const rect = hb.getBoundingClientRect();
      // Position fixed near the right edge of the hotbar
      el.style.position = 'fixed';
      el.style.left = `${Math.round(rect.right + 8)}px`;
      el.style.bottom = `${Math.round(window.innerHeight - rect.bottom + 2)}px`;
    } catch {}
  }

  // Create/position on ready and when hotbar re-renders or the window resizes
  ensureDVWidget();
  Hooks.on('renderHotbar', ensureDVWidget);
  window.addEventListener('resize', () => positionDVWidget());
  // React to DV changes from any user
  Hooks.on('updateSetting', (setting) => {
    try {
      if (setting?.key === 'lore.targetNumberValue') updateDVWidget();
    } catch {}
  });

  // One-time migration: rename actor types for existing worlds
  (async () => {
    try {
      if (!game.user?.isGM) return;
      const actors = Array.from(game.actors ?? []);
      const mappings = [
        { from: 'professional', to: 'legend' },
        { from: 'pawn', to: 'lackey' },
      ];
      for (const map of mappings) {
        const needs = actors.filter(a => a?.type === map.from);
        for (const a of needs) {
          try { await a.update({ type: map.to }); }
          catch (e) { console.warn(`Lore | Failed to migrate actor type ${map.from} -> ${map.to}:`, a, e); }
        }
        if (needs.length) console.info(`Lore | Migrated ${needs.length} actor(s) from type '${map.from}' to '${map.to}'.`);
      }
    } catch (e) {
      console.warn('Lore | Migration check failed', e);
    }
  })();

  // One-time migration: ensure prototype token link defaults by actor type
  (async () => {
    try {
      if (!game.user?.isGM) return;
      const actors = Array.from(game.actors ?? []);
      let changed = 0;
      for (const a of actors) {
        const desiredLink = a.type === 'lackey' ? false : (a.type === 'player' || a.type === 'legend' ? true : undefined);
        if (desiredLink === undefined) continue;
        const currentLink = a.prototypeToken?.actorLink;
        if (typeof currentLink === 'boolean' && currentLink === desiredLink) continue;
        try {
          await a.prototypeToken?.update({ actorLink: desiredLink });
          changed++;
        } catch (e) {
          console.warn('Lore | Failed to migrate prototype token link state for actor:', a, e);
        }
      }
      if (changed) console.info(`Lore | Updated prototype token link state for ${changed} actor(s).`);
    } catch (e) {
      console.warn('Lore | Prototype token link migration failed', e);
    }
  })();


  // Automatically add default skills to new actors
  Hooks.on('createActor', async function(actor, options, userId) {
    // Only add if actor is owned by the current user
    if (actor.isOwner) {
      // For newly created Player actors, default the prototype token disposition to Friendly
      if (actor.type === 'player' && actor.prototypeToken) {
        try {
          await actor.prototypeToken.update({
            disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
            actorLink: true,
          });
        } catch (err) {
          console.error('Lore | Failed to set default token disposition/link for Player:', err);
        }
      }
      // Ensure Legends are linked by default
      if (actor.type === 'legend' && actor.prototypeToken) {
        try {
          await actor.prototypeToken.update({ actorLink: true });
        } catch (err) {
          console.error('Lore | Failed to set default token link for Legend:', err);
        }
      }
      // Ensure Lackeys are unlinked by default
      if (actor.type === 'lackey' && actor.prototypeToken) {
        try {
          await actor.prototypeToken.update({ actorLink: false });
        } catch (err) {
          console.error('Lore | Failed to set default token link for Lackey:', err);
        }
      }

      const defaultSkills = [
        {
          name: 'Untrained',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'ref', 
          }
        },
        {
          name: 'Athletics',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'ref', 
          }
        },
        {
          name: 'Basic Knowledge',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'int', 
          }
        },
        {
          name: 'Insight',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'int', 
          }
        },
        {
          name: 'Persuasion',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'cha', 
          }
        },
        {
          name: 'Stealth',
          type: 'skill',
          img: 'systems/lore/assets/icons/D6Icon.svg', 
          system: {
            rank: { value: 1, max: 5 },
            tiedAttribute: 'ref', 
          }
        },
      ];
      // Create each skill item for the actor
      for (let skillData of defaultSkills) {
        await actor.createEmbeddedDocuments('Item', [skillData]);
      }
    }
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDocMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.lore.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'lore.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then(async (item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Use the centralized roll handler so DV and chat card logic apply
    await RollHandler.rollItem(item);
  });
}

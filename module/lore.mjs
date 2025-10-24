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
    formula: '1d6 + @attributes.ref.mod',
    decimals: 2,
  };

  CONFIG.Actor.documentClass = loreActor;
  CONFIG.Actor.dataModels = {
    player: models.lorePlayer,
    pawn: models.lorePawn,
    professional: models.loreProfessional,
  };
  
  CONFIG.Item.documentClass = loreItem;
  CONFIG.Item.dataModels = {
    gear: models.loreGear,
    weapon: models.loreWeapon,
    skill: models.loreSkill,
    magick: models.loreMagick,
    armor: models.loreArmor,
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


  // Automatically add default skills to new actors
  Hooks.on('createActor', async function(actor, options, userId) {
    // Only add if actor is owned by the current user
    if (actor.isOwner) {
      // For newly created Player actors, default the prototype token disposition to Friendly
      if (actor.type === 'player' && actor.prototypeToken) {
        try {
          await actor.prototypeToken.update({ disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
        } catch (err) {
          console.error('Lore | Failed to set default token disposition to Friendly:', err);
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

    // Do not roll for gear items
    if (item.type === 'gear') {
      return ui.notifications?.info?.(`${item.name} is gear and cannot be rolled.`);
    }

    // Trigger the item roll and send it to chat directly (no popup)
  const rollResult = await item.roll();
    const roll = rollResult instanceof Roll ? rollResult : new Roll(rollResult?.formula || '');
    const rollMode = game.settings.get('core', 'rollMode');
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: item.parent }),
      flavor: item.name,
      rollMode,
    });
  });
}

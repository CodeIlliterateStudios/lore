// Import document classes.
import { loreActor } from './documents/actor.mjs';
import { loreItem } from './documents/item.mjs';
// Import sheet classes.
import { loreActorSheet } from './sheets/actor-sheet.mjs';
import { loreItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { LORE } from './helpers/config.mjs';
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

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d6 + @attributes.ref.mod',
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = loreActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Player/Pawn as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    player: models.lorePlayer,
    pawn: models.lorePawn,
    professional: models.loreProfessional,
  };
  CONFIG.Item.documentClass = loreItem;
  CONFIG.Item.dataModels = {
    gear: models.loreGear,
    skill: models.loreSkill,
    magick: models.loreMagick,
  };

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes after confirming existence
  if (loreActorSheet && loreItemSheet) {
    foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
    foundry.documents.collections.Actors.registerSheet('lore', loreActorSheet, {
      makeDefault: true,
      label: 'LORE.SheetLabels.Actor',
    });
    foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
    foundry.documents.collections.Items.registerSheet('lore', loreItemSheet, {
      makeDefault: true,
      label: 'LORE.SheetLabels.Item',
    });
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
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
    // Automatically add default skills to new actors
    Hooks.on('createActor', async function(actor, options, userId) {
      // Only add if actor is owned by the current user
      if (actor.isOwner) {
        const defaultSkills = [
          {
            name: 'Untrained',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'ref', // Example attribute, adjust as needed
            }
          },
          {
            name: 'Athletics',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'mig', // Example attribute, adjust as needed
            }
          },
          {
            name: 'Knowledge',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'int', // Example attribute, adjust as needed
            }
          },
          {
            name: 'Notice',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'ref', // Example attribute, adjust as needed
            }
          },
          {
            name: 'Persuasion',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'cha', // Example attribute, adjust as needed
            }
          },
          {
            name: 'Stealth',
            type: 'skill',
            img: 'icons/dice/d6black.svg', // You can change the icon path
            system: {
              rank: { value: 1, max: 5 },
              tiedAttribute: 'ref', // Example attribute, adjust as needed
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

    // Trigger the item roll and send it to chat directly (no popup)
    const rollResult = await item.roll();
    const roll = rollResult instanceof Roll ? rollResult : new Roll(rollResult?.formula || '');
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: item.parent }),
      flavor: item.name,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  });
}

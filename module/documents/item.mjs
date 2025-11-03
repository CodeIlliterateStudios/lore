/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
import { RollPopup } from '../apps/roll-popup.mjs';
import { RollHandler } from '../helpers/roll-handler.mjs';

export class loreItem extends Item {
  /**
   * Return the default artwork for a new item, based on its type.
   * @param {object} itemData - The item data object
   * @returns {{img: string}}
   */
  static getDefaultArtwork(itemData = {}) {
    const type = itemData.type || "default";
    // You can customize these paths as needed
    const defaultImages = {
      gear: "icons/svg/item-bag.svg",
      weapon: "icons/svg/sword.svg",
      armor: "icons/svg/shield.svg",
      magick: "icons/svg/book.svg",
      skill: "systems/lore/assets/icons/D6Icon.svg",
      boon: "icons/svg/upgrade.svg",
      bane: "icons/svg/downgrade.svg",
      ancestry: "systems/lore/assets/default-item.png",
      default: "systems/lore/assets/default-item.png"
    };
    return { img: defaultImages[type] || defaultImages.default };
  }
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /** @override */
  async _preUpdate(changed, options, userId) {
    try {
      if (this.type === 'armor' && foundry.utils.hasProperty(changed, 'system.equipped')) {
        const newEquipped = !!foundry.utils.getProperty(changed, 'system.equipped');
        // Delegate to the parent actor to enforce exclusivity per slot
        if (this.actor?.handleArmorEquipChange) {
          await this.actor.handleArmorEquipChange(this, newEquipped);
          // No further action needed; actor method will update mapping and any other items
        }
      }
    } catch (err) {
      console.warn('LORE | Error in armor _preUpdate equip handling', err);
    }
    return super._preUpdate(changed, options, userId);
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const rollData = { ...this.system };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll(event) {
    return await RollHandler.rollItem(this);
  }
}

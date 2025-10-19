/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
import { RollPopup } from '../apps/roll-popup.mjs';

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
      gear: "icons/svg/coins.svg",
      magick: "systems/lore/assets/default-magick.png",
      skill: "icons/dice/d6black.svg",
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
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? '',
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Optionally, modify the formula string before creating the Roll object
      let rollMod = '0';
      if(this.name == 'Untrained') {
        rollMod = '-3';
      } 
      else
      {
        rollMod = rollData.actor.attributes[this.system.tiedAttribute].mod;
      }


  let formula = rollData.formula;
  // For most actors, add a final exploding d6. Pawns do NOT get this extra die.
  const isPawn = this.actor?.type === 'pawn';
  formula = `${formula} + ${rollMod}${isPawn ? '' : '+1d6x'}`;

      // Show a popup to allow an additional modifier and confirmation
      const popup = new RollPopup({ rollType: 'item', rollData: { formula }, label });
      popup.render(true);
      try {
        await popup.awaitConfirm();
      } catch (err) {
        return null;
      }

      // Append user-entered modifier if any
      const extra = Number(popup.modifier) || 0;
      if (extra !== 0) {
        const sign = extra >= 0 ? '+' : '-';
        const abs = Math.abs(extra);
        formula = `${formula} ${sign} ${abs}`;
      }

      // Invoke the roll and submit it to chat.
      const roll = new Roll(formula, rollData.actor);
      await roll.evaluate();
      await roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}

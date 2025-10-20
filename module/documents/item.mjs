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
      gear: "icons/svg/item-bag.svg",
      weapon: "icons/svg/sword.svg",
      magick: "icons/svg/book.svg",
      skill: "systems/lore/assets/icons/D6Icon.svg",
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
      // Skills use tiedAttribute and special case for Untrained; others default to 0 mod here
      let rollMod = '0';
      if (this.type === 'skill') {
        if (this.name === 'Untrained') {
          rollMod = '-3';
        } else {
          const tied = this.system?.tiedAttribute;
          const mod = tied ? rollData.actor?.attributes?.[tied]?.mod : undefined;
          rollMod = (mod ?? 0).toString();
        }
      }
      if (this.type === 'weapon') {
        // Determine attack attribute based on weapon type
        // melee -> Might (mig), ranged -> Reflex (ref)
        const wType = this.system?.weaponType || 'melee';
        const attrKey = wType === 'ranged' ? 'ref' : 'mig';
        const mod = rollData.actor?.attributes?.[attrKey]?.mod;
        rollMod = (mod ?? 0).toString();
      }


  let formula = rollData.formula;
  // For most actors, add a final exploding d6. Pawns do NOT get this extra die.
  const isPawn = this.actor?.type === 'pawn';
  formula = `${formula} + ${rollMod}`;

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

      // Invoke the roll and merge with optional LORE Die into a single chat card.
      const roll = new Roll(formula, rollData.actor);
      await roll.evaluate();

  let content = await roll.render();
  /** @type {Roll[]} */
  const rolls = [roll];
  let loreTotal = 0;

      // LORE Die: skills only, for players and professionals (pawns do not roll a LORE Die)
      try {
        const actorType = this.actor?.type ?? '';
        const qualifies = (this.type === 'skill') && (actorType === 'player' || actorType === 'professional');
        if (qualifies) {
          const loreRoll = new Roll('1d6');
          await loreRoll.evaluate();
          const loreHtml = await loreRoll.render();
          content += `\n<div class=\"lore-die\">LORE Die${loreHtml}</div>`;
          rolls.push(loreRoll);
          loreTotal = Number(loreRoll.total) || 0;
        }
      } catch (e) {
        console.warn('LORE | Failed to roll/render LORE Die for skill:', e);
      }

      // Apply Morale as a final modifier after all dice are rolled
      const morale = Number(this.actor?.system?.morale ?? 0);
      if (morale !== 0) {
        const sign = morale >= 0 ? '+' : '-';
        const abs = Math.abs(morale);
        content += `\n<div class=\"lore-morale-mod\">Morale: ${sign}${abs}</div>`;
      }
      const finalTotal = (Number(roll.total) || 0) + loreTotal + morale;
      content += `\n<div class=\"lore-final-total\" style=\"margin-top:6px;padding-top:6px;border-top:1px solid var(--color-border-light, #999);\"><strong>Final Result:</strong> ${finalTotal}</div>`;

      await ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content,
        rolls,
      });

      return roll;
    }
  }
}

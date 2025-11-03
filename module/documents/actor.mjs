/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class loreActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  async _preUpdate(changed, options, userId) {
    // If wounds are changing, automatically toggle unconscious when reaching max
    try {
      const hasWoundsUpdate = foundry.utils.hasProperty(
        changed,
        'system.wounds.value'
      );
      const hasFatigueUpdate = foundry.utils.hasProperty(
        changed,
        'system.fatigue.value'
      );
      if (hasWoundsUpdate) {
        const newWounds = Number(
          foundry.utils.getProperty(changed, 'system.wounds.value')
        );
        // Fall back to current if new value is not a number (shouldn't happen, but be safe)
        const targetWounds = Number.isFinite(newWounds)
          ? newWounds
          : Number(this.system?.wounds?.value ?? 0);
        const maxWounds = Number(this.system?.wounds?.max ?? 3);
        // Only auto-SET unconscious when reaching/exceeding max; never auto-clear.
        // Also, if this same update explicitly sets system.unconscious, respect that.
        const explicitUncChange = foundry.utils.hasProperty(changed, 'system.unconscious');
        if (!explicitUncChange && targetWounds >= maxWounds && !this.system?.unconscious) {
          foundry.utils.setProperty(changed, 'system.unconscious', true);
        }
      }

      // If fatigue is changing, automatically set incapacitated when reaching max; never auto-clear.
      if (hasFatigueUpdate) {
        const newFatigue = Number(
          foundry.utils.getProperty(changed, 'system.fatigue.value')
        );
        const targetFatigue = Number.isFinite(newFatigue)
          ? newFatigue
          : Number(this.system?.fatigue?.value ?? 0);
        const maxFatigue = Number(this.system?.fatigue?.max ?? 3);
        const explicitIncChange = foundry.utils.hasProperty(changed, 'system.incapacitated');
        if (!explicitIncChange && targetFatigue >= maxFatigue && !this.system?.incapacitated) {
          foundry.utils.setProperty(changed, 'system.incapacitated', true);
        }
      }
    } catch (err) {
      console.warn('LORE: Failed to auto-toggle unconscious on wounds change', err);
    }
    // If ancestry slot changed, recompute tags in the same update
    try {
      if (foundry.utils.hasProperty(changed, 'system.equippedAncestry')) {
        const override = {
          equippedAncestry: foundry.utils.getProperty(changed, 'system.equippedAncestry') ?? this.system?.equippedAncestry,
        };
        const nextTags = this._computeTagsFromItems(override);
        if (Array.isArray(nextTags)) {
          foundry.utils.setProperty(changed, 'system.tags', nextTags);
        }
        // Persist fresh auto-tags snapshot for reliable manual vs auto diffing
        const autoNow = this._computeAutoTagsFromItems(override);
        foundry.utils.setProperty(changed, 'flags.lore.autoTags', Array.isArray(autoNow) ? autoNow : []);
      }
    } catch (err) {
      console.warn('LORE: Failed to recompute tags on ancestry change', err);
    }
    return super._preUpdate(changed, options, userId);
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data that isn't
   * handled by the actor's DataModel. Data calculated in this step should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
  super.prepareDerivedData();
  const actorData = this;
  const flags = actorData.flags.lore || {};
  }

  /**
   * Compute only the auto-applied tags that derive from owned items (currently: equipped ancestry).
   * Does not include any manual tags. Used to persist a flag for reliable diffing/removal.
   * @param {object} [override] Optional overrides like { equippedAncestry }
   * @returns {string[]} Array of auto-applied tags
   */
  _computeAutoTagsFromItems(override = {}) {
    try {
      // Determine the equipped ancestry item
      const eqId = override?.equippedAncestry ?? this.system?.equippedAncestry ?? '';
      let ancestryItem = null;
      if (eqId) ancestryItem = this.items.get(eqId) ?? null;
      const tagKey = String(ancestryItem?.system?.tag ?? '').trim();
      const sizeKey = String(ancestryItem?.system?.sizeTag ?? '').trim();

      // Collect extra non-ancestry tags from ancestry (comma/space separated string)
      const extra = ancestryItem?.system?.extraTags;
      const extraRaw = Array.isArray(extra) ? extra : String(extra ?? '').trim();
      /** @type {string[]} */
      let extraTags = [];
      if (Array.isArray(extraRaw)) {
        extraTags = extraRaw;
      } else if (extraRaw) {
        extraTags = extraRaw
          .split(/[\s,]+/)
          .map(t => String(t || '').trim())
          .filter(Boolean);
      }

      const out = new Set();
      if (tagKey) out.add(`ancestry:${tagKey}`);
      if (sizeKey) out.add(`size:${sizeKey}`);
      for (const t of extraTags) {
        const norm = String(t).trim();
        if (norm) out.add(norm.toLowerCase());
      }
      return Array.from(out);
    } catch (e) {
      console.warn('LORE | Error computing auto tags for actor', e);
      return [];
    }
  }

  /**
   * Compute the actor's tags based on owned items and system state.
   * Currently: ancestry contributes a single tag from the ancestry item's system.tag.
   * Manual tags are preserved by subtracting previously auto-applied tags stored in flags.lore.autoTags.
   * @param {object} [override] Optional overrides like { equippedAncestry }
   * @returns {string[]} Array of tags
   */
  _computeTagsFromItems(override = {}) {
    try {
      const existing = Array.isArray(this.system?.tags) ? this.system.tags : [];
      const prevAuto = Array.isArray(this.flags?.lore?.autoTags) ? this.flags.lore.autoTags : [];

      // Manual tags = existing minus previous auto-applied tags and minus any ancestry-prefixed tags
      const prevAutoSet = new Set(prevAuto.map(t => String(t)));
      const manual = existing
        .filter(t => typeof t === 'string' && !t.startsWith('ancestry:'))
        .filter(t => !prevAutoSet.has(t));

      // Fresh auto tags from current items
      const autoNow = this._computeAutoTagsFromItems(override);
      const out = new Set();
      for (const t of manual) {
        const norm = String(t).trim();
        if (norm) out.add(norm);
      }
      for (const t of autoNow) {
        const norm = String(t).trim();
        if (norm) out.add(norm);
      }
      return Array.from(out);
    } catch (e) {
      console.warn('LORE | Error computing tags for actor', e);
      return Array.isArray(this.system?.tags) ? this.system.tags : [];
    }
  }

  /**
   * Ensure only one armor per slot is equipped. Called when an armor item's equipped checkbox changes.
   * @param {Item} armorItem - The armor Item being toggled
   * @param {boolean} equipped - The target equipped state
   */
  async handleArmorEquipChange(armorItem, equipped) {
    try {
      if (!armorItem || armorItem.type !== 'armor') return;
      const slot = armorItem.system?.armorType ?? 'body';
      const currentId = this.system?.equippedArmor?.[slot] ?? '';
      const updates = [];

      if (equipped) {
        // If another item is equipped in this slot, unequip it
        if (currentId && currentId !== armorItem.id) {
          const prev = this.items.get(currentId);
          if (prev) {
            updates.push({ _id: prev.id, 'system.equipped': false });
          }
        }
        // Set mapping to this item (do not update the current item here to avoid recursion)
        await this.update({ [`system.equippedArmor.${slot}`]: armorItem.id });
      } else {
        // Unequip this item; clear mapping if it was the mapped one
        if (currentId === armorItem.id) {
          await this.update({ [`system.equippedArmor.${slot}`]: '' });
        }
      }

      if (updates.length) {
        await this.updateEmbeddedDocuments('Item', updates);
      }
    } catch (err) {
      console.warn('LORE | Failed to handle armor equip change', err);
    }
  }

  /**
   *
   * @override
   * Augment the actor's default getRollData() method by appending the data object
   * generated by the its DataModel's getRollData(), or null. This polymorphic
   * approach is useful when you have actors & items that share a parent Document,
   * but have slightly different data preparation needs.
   */
  getRollData() {
    return { ...super.getRollData(), ...(this.system.getRollData?.() ?? null) };
  }
}

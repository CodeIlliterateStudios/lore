import loreItemBase from './base-item.mjs';

export default class loreBoon extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Boon',
  ];

  static defineSchema() {
    // For now, Boon uses only the base item fields (cost, weight, description)
    // You can extend with additional fields later (e.g., magnitude, trigger, etc.)
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    // When enabled, indicates this Boon modifies the Magicks background
    schema.magicksBackground = new fields.BooleanField({ initial: false });

    return schema;
  }

  prepareDerivedData() {
    // No derived data yet; reserved for future logic
  }
}

import loreItemBase from './base-item.mjs';

export default class loreBane extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Bane',
  ];

  static defineSchema() {
    // For now, Bane uses only the base item fields (cost, weight, description)
    // You can extend with additional fields later (e.g., severity, trigger, etc.)
    const schema = super.defineSchema();
    return schema;
  }

  prepareDerivedData() {
    // No derived data yet; reserved for future logic
  }
}

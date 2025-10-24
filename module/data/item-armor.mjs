import loreItemBase from './base-item.mjs';

// Blank template for Armor item data
// Extend and add fields as needed (e.g., protection value, type, penalties)
export default class loreArmor extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Armor',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // Equipped toggle for UI/state
    schema.equipped = new fields.BooleanField({
      initial: false,
    });

    // Armor location/type
    schema.armorType = new fields.StringField({
      initial: 'body',
      choices: ['head', 'body', 'arms', 'hands', 'legs', 'feet'],
    });

    // Armor rating/value
    schema.armorValue = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    return schema;
  }

  prepareDerivedData() {
    // TODO: Compute any derived values for armor here
  }
}

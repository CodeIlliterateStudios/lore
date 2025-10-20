import loreItemBase from './base-item.mjs';

export default class loreArmor extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Armor',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 1,
    });

    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Simple defensive rating field; adjust later as desired
    schema.armorValue = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }
}

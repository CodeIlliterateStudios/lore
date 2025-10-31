import loreItemBase from './base-item.mjs';

export default class loreMagick extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Magick',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    

    schema.magickResourceCost = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    return schema;
  }
}

import loreItemBase from './base-item.mjs';

export default class loreMagick extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Magick',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    

    return schema;
  }
}

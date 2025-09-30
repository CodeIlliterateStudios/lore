
export default class loreItemBase extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LORE.Item.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.HTMLField();

    return schema;
  }
}

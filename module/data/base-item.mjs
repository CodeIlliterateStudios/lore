
export default class loreItemBase extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LORE.Item.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    schema.cost = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    schema.description = new fields.HTMLField();

    return schema;
  }

  prepareDerivedData() {
    
  }
}

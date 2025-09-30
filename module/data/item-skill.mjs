import loreItemBase from './base-item.mjs';

export default class loreSkill extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Skill',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.rank = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 5 }),
    });

    // Add tiedAttribute field, choices from LORE.attributeTypes keys
    schema.tiedAttribute = new fields.StringField({
      required: true,
      initial: 'ref', // default to first attribute, adjust as needed
      choices: Object.keys(CONFIG.LORE?.attributeTypes ?? { ref: '', int: '', gri: '', mig: '', phy: '', cha: '' })
    });

    return schema;
  }
}

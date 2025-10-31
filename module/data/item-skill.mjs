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

    // Flat modifier applied to this skill's rolls (can be negative)
    schema.modifier = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: -999,
      step: 1,
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    
    // this.parent should be the Item's parent (the Actor)
    const actor = this.parent.parent;
    if (!actor || !this.tiedAttribute) return 0;
    // Defensive: check if attributes exist and have the tied attribute
    const attr = actor.system.attributes?.[this.tiedAttribute];

    // Build the formula dynamically using string interpolation
    const roll = this.roll;
    let diceNum = this.rank.value;

    this.formula = `${diceNum}d6khx`;
  }
}

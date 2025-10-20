import loreItemBase from './base-item.mjs';

export default class loreWeapon extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Weapon',
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

    // basic weapon roll parts
    schema.roll = new fields.SchemaField({
      diceNum: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      diceSize: new fields.StringField({ initial: 'd6' }),
      diceBonus: new fields.StringField({ initial: '' }),
    });

    // Damage roll supports either a direct formula string (e.g., "1d6+2")
    // or discrete parts that will be combined into a formula.
    schema.damage = new fields.SchemaField({
      // Optional direct formula string. If provided, it will be preferred.
      formula: new fields.StringField({ blank: true, initial: '' }),
      // Fallback parts if no formula string is provided.
      diceNum: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),
      diceSize: new fields.StringField({ initial: 'd6' }),
      diceBonus: new fields.StringField({ initial: '' }),
    });

    schema.formula = new fields.StringField({ blank: true });
    schema.damageFormula = new fields.StringField({ blank: true });

    return schema;
  }

  prepareDerivedData() {
    const roll = this.roll ?? {};
    const dmg = this.damage ?? {};
    const toPart = (p) => {
      if (!p) return '';
      const n = Number(p.diceNum) || 0;
      const size = p.diceSize || '';
      const bonus = (p.diceBonus ?? '').toString().trim();
      if (n <= 0 || !size) return bonus || '';
      return `${n}${size}${bonus ? bonus.startsWith('+') || bonus.startsWith('-') ? bonus : `+${bonus}` : ''}`;
    };
    // Attack roll formula (no direct string yet; can be extended similarly if needed)
    this.formula = toPart(roll);
    // Prefer a direct damage formula string if supplied; otherwise compose from parts
    const directDamage = (dmg.formula ?? '').toString().trim();
    this.damageFormula = directDamage || toPart(dmg);
  }
}

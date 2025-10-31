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


    // weapon category/type
    schema.weaponType = new fields.StringField({
      initial: 'melee',
      choices: ['melee', 'ranged'],
    });

    // handedness: one-handed or two-handed
    schema.handedness = new fields.StringField({
      initial: 'one',
      choices: ['one', 'two'],
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
  // Flat numeric modifier that is added to the final damage roll (can be negative)
  modifier: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.formula = new fields.StringField({ blank: true });
    schema.damageFormula = new fields.StringField({ blank: true });

    // Provides optional reach for melee and range bands for ranged weapons
    schema.range = new fields.SchemaField({
      // Melee reach distance (grid units); 0 means standard adjacent only
      reach: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      // Range bands for ranged/thrown weapons; 0 indicates not applicable/unused
      short: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      medium: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      long: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      // Free-text units label (e.g., 'ft', 'm', 'sq'); purely descriptive for now
      units: new fields.StringField({ initial: 'ft' }),
    });

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
    let baseDamage = directDamage || toPart(dmg);
    // Ensure damage dice explode on 6: add an 'x' after any d6 that doesn't already have it
    if (baseDamage) {
      baseDamage = baseDamage.replace(/\bd6(?!x)\b/gi, 'd6x');
    }
    // Append flat numeric modifier if present and non-zero
    const flatMod = Number(dmg.modifier ?? 0) || 0;
    if (flatMod !== 0) {
      this.damageFormula = baseDamage ? `${baseDamage} + ${flatMod}` : `${flatMod}`;
    } else {
      this.damageFormula = baseDamage;
    }
  }
}

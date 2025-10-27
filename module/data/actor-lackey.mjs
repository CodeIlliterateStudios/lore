import loreActorBase from './base-actor.mjs';

export default class loreLackey extends loreActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'LORE.Actor.Lackey',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // Lackeys mirror Pawn defaults: start with max 1 Wound and 1 Fatigue
    if (schema?.wounds?.fields) {
      schema.wounds.fields.max = new fields.NumberField({ ...requiredInteger, initial: 1 });
    }
    if (schema?.fatigue?.fields) {
      schema.fatigue.fields.max = new fields.NumberField({ ...requiredInteger, initial: 1 });
    }

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getRollData() {
    super.getRollData();
  }
}

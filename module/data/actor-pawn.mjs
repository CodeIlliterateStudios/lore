import loreActorBase from './base-actor.mjs';

export default class lorePawn extends loreActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'LORE.Actor.Pawn',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // Override base defaults: pawns start with max 1 Wound and 1 Fatigue,
    // but these remain modifiable by users/effects. We only replace the
    // 'max' subfields to avoid reusing field instances across parents.
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

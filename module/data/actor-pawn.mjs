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

    

    return schema;
  }

  prepareDerivedData() {
    
  }
}

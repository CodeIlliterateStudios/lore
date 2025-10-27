import loreActorBase from './base-actor.mjs';

export default class loreLegend extends loreActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'LORE.Actor.Legend',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    
    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getRollData() {
    super.getRollData();
  }
}

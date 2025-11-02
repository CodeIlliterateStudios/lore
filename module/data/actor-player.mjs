import loreActorBase from './base-actor.mjs';

export default class lorePlayer extends loreActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'LORE.Actor.Player',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.playerName = new fields.StringField({ initial: "" });
    // Lore Coins: players start with 2, minimum 0
    schema.loreCoin = new fields.NumberField({ ...requiredInteger, initial: 2, min: 0 });
    
    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getRollData() {
    super.getRollData();
    const data = {};


    data.lvl = this.level.value;

    return data;
  }
}

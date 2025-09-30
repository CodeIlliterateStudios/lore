export default class loreActorBase extends foundry.abstract
  .TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LORE.Actor.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0, }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3 }),
    });

    schema.fatigue = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3 }),
    });

    // Iterate over attribute names and create a new SchemaField for each.
    schema.attributes = new fields.SchemaField(
      Object.keys(CONFIG.LORE.attributes).reduce((obj, attribute) => {
        obj[attribute] = new fields.SchemaField({
          value: new fields.NumberField({
            ...requiredInteger,
            initial: 1,
            min: 1,
          }),
        });
        return obj;
      }, {})
    );
    schema.biography = new fields.HTMLField();

    return schema;
  }

  prepareDerivedData() {
    // Loop through attribute scores, and add their modifiers to our sheet output.
    for (const key in this.attributes) {
      // Modifier is value - 1 (rank 1 = 0, rank 2 = 1, etc).
      this.attributes[key].mod = (this.attributes[key].value - 1);
      // Handle attribute label localization.
      this.attributes[key].label =
        game.i18n.localize(CONFIG.LORE.attributes[key]) ?? key;
    }
  }

   getRollData() {
    const data = {};

    // Copy the attribute scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (this.attributes) {
      for (let [k, v] of Object.entries(this.attributes)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.lvl = this.level.value;

    return data;
  }
}

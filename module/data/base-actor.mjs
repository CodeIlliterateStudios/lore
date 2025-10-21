export default class loreActorBase extends foundry.abstract
  .TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LORE.Actor.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.level = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1 })
    });

    schema.wounds = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0, }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3 }),
    });

    schema.incapacitated = new fields.BooleanField({ initial: false });

    schema.fatigue = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3 }),
    });

    schema.unconscious = new fields.BooleanField({ initial: false });

    schema.stunned = new fields.BooleanField({ initial: false });

    schema.movement = new fields.NumberField({ ...requiredInteger, initial: 6, min: 0 });
    schema.parry = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.toughness = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    schema.morale = new fields.NumberField({ ...requiredInteger, initial: 0, min: -6, max: 6 });

    // Iterate over attribute names and create a new SchemaField for each.
    schema.attributes = new fields.SchemaField(
      Object.keys(CONFIG.LORE.attributes).reduce((obj, attribute) => {
        obj[attribute] = new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 5 }),
          type: new fields.StringField({ initial: CONFIG.LORE.attributeTypes[attribute] }),
          mod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        });
        return obj;
      }, {})
    );

    
    schema.ancestry = new fields.StringField({ initial: "" });
    schema.gender = new fields.StringField({ initial: "" });
    schema.age = new fields.StringField({ initial: "" });
    schema.height = new fields.StringField({ initial: "" });
    schema.weight = new fields.StringField({ initial: "" });

    schema.biography = new fields.HTMLField();

    schema.equippedWeapons = new fields.SchemaField({
      mainhand: new fields.StringField({ initial: "" }), // Item ID or ""
      offhand: new fields.StringField({ initial: "" }),
    });

    schema.equippedArmor = new fields.SchemaField({
      head: new fields.StringField({ initial: "" }),
      body: new fields.StringField({ initial: "" }),
      arms: new fields.StringField({ initial: "" }),
      hands: new fields.StringField({ initial: "" }),
      legs: new fields.StringField({ initial: "" }),
      feet: new fields.StringField({ initial: "" }),
    });

    return schema;
  }



  prepareDerivedData() {

    // Loop through attribute scores, and add their modifiers to our sheet output.
    for (const key in this.attributes) {
      let mod = this.attributes[key].value - 1;
      if(this.attributes[key].type === 'physical') {
        mod -= this.wounds.value;
      } else if(this.attributes[key].type === 'mental') {
        mod -= this.fatigue.value;
      }
      
      this.attributes[key].mod = mod;
      // Handle attribute label localization.
      this.attributes[key].label =
        game.i18n.localize(CONFIG.LORE.attributes[key]) ?? key;
    }

    
    let parry = 2;
    // Handle Parry calculation.
    this.parry = parry;

    
    let toughness = 2;
    // Handle Toughness calculation.
    this.toughness = toughness;

  // Do defense calculation here once implemented.
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

    return data;
  }
}

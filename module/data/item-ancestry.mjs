import loreItemBase from './base-item.mjs';

export default class loreAncestry extends loreItemBase {
  static LOCALIZATION_PREFIXES = [
    'LORE.Item.base',
    'LORE.Item.Ancestry',
  ];

  static defineSchema() {
    // Start with base item schema; ancestries can add fields later
    const schema = super.defineSchema();
    const fields = foundry.data.fields;
    // Rudimentary tag key applied to actor when this ancestry is equipped
    schema.tag = new fields.StringField({ initial: '' });
  // Optional size tag applied to the actor (e.g., small, medium, large)
  schema.sizeTag = new fields.StringField({ initial: '' });
    // Optional: additional non-ancestry tags to apply to the actor when this ancestry is equipped.
    // Stored as a comma-separated string for simple editing; parsed in actor logic.
    schema.extraTags = new fields.StringField({ initial: '' });
    // Controls which biography fields appear on actors using this ancestry.
    // Defaults to true to maintain current behavior (all fields visible).
    schema.bioFields = new fields.SchemaField({
      gender: new fields.BooleanField({ initial: true }),
      age: new fields.BooleanField({ initial: true }),
      height: new fields.BooleanField({ initial: true }),
      weight: new fields.BooleanField({ initial: true }),
    });
    return schema;
  }

  prepareDerivedData() {
    // No derived data yet for ancestry items
  }
}

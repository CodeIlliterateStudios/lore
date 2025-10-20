export const LORE = {};

/**
 * The set of Attribute Scores used within the system.
 * @type {Object}
 */
LORE.attributes = {
  ref: 'LORE.Attribute.Ref.long',
  int: 'LORE.Attribute.Int.long',
  gri: 'LORE.Attribute.Gri.long',
  mig: 'LORE.Attribute.Mig.long',
  phy: 'LORE.Attribute.Phy.long',
  cha: 'LORE.Attribute.Cha.long',
};

LORE.attributeAbbreviations = {
  ref: 'LORE.Attribute.Ref.abbr',
  int: 'LORE.Attribute.Int.abbr',
  gri: 'LORE.Attribute.Gri.abbr',
  mig: 'LORE.Attribute.Mig.abbr',
  phy: 'LORE.Attribute.Phy.abbr',
  cha: 'LORE.Attribute.Cha.abbr',
};

/**
 * The type of each attribute: 'physical' or 'mental'.
 * @type {Object}
 */
LORE.attributeTypes = {
  ref: 'physical',
  int: 'mental',
  gri: 'mental',
  mig: 'physical',
  phy: 'physical',
  cha: 'mental',
};

/**
 * Weapon type options
 */
LORE.weaponTypes = {
  melee: 'LORE.Item.Weapon.Types.melee',
  ranged: 'LORE.Item.Weapon.Types.ranged',
};

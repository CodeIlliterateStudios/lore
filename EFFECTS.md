# Active Effects in LORE

This system supports Foundry VTT Active Effects on Items and Actors. With this, Boons and Banes can modify almost any part of a character while they are owned by and equipped on the Actor.

## Where to manage effects
- Item sheets now include an Effects tab. Open a Boon or Bane and go to Effects to add changes.
- Actor sheets also include an Effects tab to view all applicable effects (from the Actor and from owned Items).

## Transferable effects from Items
When you create an effect from an Item sheet, it defaults to `transfer: true`, meaning the effect will apply to the owning Actor automatically. You can toggle `Disabled` on the effect to turn it off without deleting it.

## Common effect keys
Active Effect changes are key/value operations. The key is a data path on the Actor. For LORE, useful paths include:
- system.attributes.{attr}.value — base attribute value (str, agi, int, etc.)
- system.attributes.{attr}.max — max for an attribute
- system.attributes.{attr}.mod — modifier (normally computed, prefer changing value and let mod recalc)
- system.movement — movement score
- system.parry — parry score
- system.toughness — toughness score
- system.wounds.value — current wounds
- system.wounds.max — max wounds
- system.fatigue.value — current fatigue
- system.fatigue.max — max fatigue
- system.morale — morale value (-6 to 6)
- system.magicksResource.value — current magicks resource
- system.magicksResource.max — max magicks resource
- system.unconscious — boolean
- system.stunned — boolean
- flags.lore.* — any custom flag values if you prefer placing custom data under flags

Tip: If you want a boon/bane to change a number, prefer using mode "ADD" or "MULTIPLY". If you want to set a boolean or force a specific number, use mode "OVERRIDE".

## Example changes
- +1 Strength while a Boon is active
  - key: system.attributes.str.value
  - mode: ADD
  - value: 1
  - priority: 20

- Set Toughness to 3 exactly (overrides all math)
  - key: system.toughness
  - mode: OVERRIDE
  - value: 3
  - priority: 50

- Mark actor as Stunned (boolean)
  - key: system.stunned
  - mode: OVERRIDE
  - value: true

## Stacking and priority
Foundry applies effects in priority order (lower before higher). You can tune the `priority` field when multiple effects touch the same key. In general, leave priority alone unless you need a specific ordering.

## Notes and caveats
- Derived fields like `system.attributes.*.mod` are recalculated during Actor preparation. Modifying `value` is recommended; the system will recompute `mod` accordingly and also factor wounds/fatigue.
- If you raise `wounds.value` or `fatigue.value` to the max through effects, core auto-toggles for `unconscious`/`incapacitated` still apply on normal updates; effect-based overrides can set those booleans directly if desired.
- For keys not listed above, you can target any field that exists under the Actor's `system` data.

## Troubleshooting
- If an Item effect isn’t applying, make sure it has `transfer` enabled and the Item is owned by the Actor.
- Use the Actor’s Effects tab to confirm the effect is active and not disabled.
- Double-check the key path spelling; it must match the Actor data exactly.

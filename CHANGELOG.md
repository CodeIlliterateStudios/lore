# CHANGELOG


## Unreleased

### Bug-fixes

- Actor sheet: clicking the equipped Ancestry now opens the item sheet reliably instead of opening a new browser window/tab. Prevented default link navigation in the action handler.


## 0.0.3 - 2025-10-31

### UX

- Implemented targeting for weapon skill and damage rolls.
- Added a Target Number window next to hotbar for GM to set a global target number for all rolls. Setting this to 0 will ignore it and allow a manual per-roll target number.
- Roll Popup now synchronizes its Target Number field with the global Target Number (when set).
- Added weapon damage modifier.

### UI

- Improved general layout and styling.
- Roll cards now display the targeted token's image and name (when a target is selected).
- Chat messages include a visibility label for clearer context.
- Polished styles for resource checkboxes and multiple UI areas (sidebar, skills, and tab navigation).
- Exploded dice in roll cards are now clearly highlighted (color shift, outline, and glow) for better readability.
- Gear tab weapon list shows computed damage formula and appropriate context:
    - Melee rows display the attack modifier derived from Might.
    - Ranged rows hide the modifier column and show range bands.
    - Reach and range units are displayed when provided. 

### Changes

- Terminology updates:
    - Difficulty renamed to Target Number (TN).
    - Actor types renamed: Pawn → Lackey; Professional → Legend.
- Prototype token link defaults now vary by actor type.
- Base movement default set to 5 (was 6).
- Weapon damage dice now explode by default on d6; formulas normalize to use `d6x`.
- Weapon items support range/reach data and a flat damage modifier that is incorporated into a computed `damageFormula` (or a direct formula string when supplied).

### Internal

- Added dedicated data modules for actor subtypes: `actor-lackey.mjs` and `actor-legend.mjs`.
- Introduced a dedicated hotbar Target Number component and styles: `templates/components/hotbar-target-number.hbs`, `src/less/components/hotbar-target-number.less`.
- General CSS cleanup and variable usage improvements across LESS/CSS.
- Removed obsolete stylesheet `css/item-armor-fix.css`.
- Added `equipWeapon` helper on the base actor data model to enforce one-/two-handed rules and maintain `mainhand`/`offhand` slots consistently.
- Weapon schema extended: `handedness`, `range` (reach and bands), and damage composition fields; derived `formula` and `damageFormula` now computed.

### Bug-fixes

- Fixed a bug where multiple instances of default skills were being applied for each logged in GM instead of only once on creation.
- Actor header level input now binds correctly to `system.level.value`.

### Docs

- README updated to clarify the Critical Failure rule: it triggers when the LORE die shows 1 and more than half of the normal dice also show 1.

## 0.0.2 - 2025-10-26

### Features

- Boon item: added a "Magicks Background" toggle (boolean field) and UI checkbox, enabling boons to mark that they modify a character's Magicks background.

- Actor sheet: the Magicks tab is now shown only when the actor has at least one Boon with the "Magicks Background" toggle enabled. Applies to Player, Lackey, and Legend actor types.

### UX

- Tab state is now validated on render. If a previously active tab (e.g., Magicks) becomes unavailable due to data changes, the sheet automatically selects the first available tab instead of leaving no tab active.
- Roll automation overhaul:
    - Centralized roll handling via `RollHandler` for attribute (inline) and item rolls.
    - New confirmation popup (`RollPopup`) with on-the-fly modifier input and optional Target Number field (for attributes and skills). Shows a live, human-readable formula preview that resolves `@data` paths to current values and displays the current user target.
    - Skills: automatically applies the tied attribute modifier; Untrained imposes -3. Optionally rolls a LORE die for qualifying actors (Players/Legends). Computes success and raises versus the Target Number.
    - Weapons: automatically uses MIG (melee) or REF (ranged) modifiers; hides the Target Number field and does not add a LORE die for damage rolls.
    - Morale is automatically applied to the final total. Critical Failure updated: triggers when the LORE die shows 1 and more than half of the normal dice also show 1.
    - Chat cards now include dice-face icons for each die, a separate LORE die section when used, Morale breakdown, final total, and roll metadata flags (roll type, name, target number, success, raises, `critFailure`).
    - Gear items are non-rollable and now post their description to chat instead of attempting a roll.

## 0.0.1

### Features

- Added Foundry VTT compatibility for version v13.

- Added Initial base actor and item data and sheets.
- Actor types:
    - Player
    - Legend
    - Lackey.
- Item Types:
    - Armor
    - Gear
    - Magicks
    - Skill
    - Weapon
- Implemented roll functionality for attributes, skills, and weapons.
- Implemented LORE die for player and legend actors.
- Implemented equipment functionality to actors for weapons and armor.


### UI
- Created basic dark and light theme style sheets for all actors and items.
- Created custom chat roll cards for all rolls.
- Added LORE Logo
- Added new dice faces for roll visuals in the chat.
- Added a paper doll tab to actor gear.

### Bugfixes

- None


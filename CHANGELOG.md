# CHANGELOG


## Unreleased

### Features

- Boon item: added a Magicks Background toggle (boolean field) and UI checkbox, enabling boons to mark that they modify a character's Magicks background.

- Actor sheet: Magicks tab is now shown only when the actor has at least one Boon with the Magicks Background toggle enabled. Applies to Player, Pawn, and Professional actor types.

### UX

- Tab state is now validated on render. If a previously active tab (e.g., Magicks) becomes unavailable due to data changes, the sheet automatically selects the first available tab instead of leaving no tab active.
- Roll automation overhaul:
    - Centralized roll handling via `RollHandler` for attribute (inline) and item rolls.
    - New confirmation popup (`RollPopup`) with on-the-fly modifier input and optional Difficulty field (for attributes and skills). Shows a live, human-readable formula preview that resolves @data paths to current values and displays the current user target.
    - Skills: automatically applies the tied attribute modifier; Untrained imposes -3. Optionally rolls a LORE die for qualifying actors (Players/Professionals). Computes success and raises versus Difficulty.
    - Weapons: automatically uses MIG (melee) or REF (ranged) modifiers; hides the Difficulty field and does not add a LORE die for damage rolls.
    - Morale is automatically applied to the final total. Detects Critical Failure ("Snake Eyes") when both the main kept die and LORE die show 1.
    - Chat cards now include dice face icons for each die, a separate LORE die section when used, Morale breakdown, final total, and roll metadata flags (roll type, name, difficulty, success, raises, critFailure).
    - Gear items are non-rollable and now post their description to chat instead of attempting a roll.

## 0.0.1

### Features

- Added Foundry VTT compatibility for version v13.

- Added Initial base actor and item data and sheets.
- Actor types:
    - Player
    - Professional
    - Pawn.
- Item Types:
    - Armor
    - Gear
    - Magicks
    - Skill
    - Weapon
- Implemented roll functionality for attributes, skills, and weapons.
- Implemented LORE die for player and professional actors.
- Implemented equipment functionality to actors for weapons and armor.


### UI
- Created basic dark and light theme style sheets for all actors and items.
- Created custom chat roll cards for all rolls.
- Added LORE Logo
- Added new dice faces for roll visuals in the chat.
- Added a paper doll tab to actor gear.

### Bugfixes

- None


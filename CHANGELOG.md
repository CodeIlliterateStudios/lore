# CHANGELOG


## 0.0.3 - 2025-10-31

### UX

- Implemented targeting for weapon skill and damage rolls.
- Added a Target Number window next to hotbar for GM to set a global target number for all rolls. Setting this to 0 will ignore it and allow a manual per-roll target number.
- Roll Popup now synchronizes its Target Number field with the global Target Number (when set).

### UI

- Improved general layout and styling.
- Roll cards now display the targeted token's image and name (when a target is selected).
- Chat messages include a visibility label for clearer context.
- Polished styles for resource checkboxes and multiple UI areas (sidebar, skills, and tab navigation).

### Changes

- Terminology updates:
    - Difficulty renamed to Target Number (TN).
    - Actor types renamed: Pawn → Lackey; Professional → Legend.
- Prototype token link defaults now vary by actor type.

### Internal

- Added dedicated data modules for actor subtypes: `actor-lackey.mjs` and `actor-legend.mjs`.
- Introduced a dedicated hotbar Target Number component and styles: `templates/components/hotbar-target-number.hbs`, `src/less/components/hotbar-target-number.less`.
- General CSS cleanup and variable usage improvements across LESS/CSS.
- Removed obsolete stylesheet `css/item-armor-fix.css`.

### Bug-fixes

- Fixed a bug where multiple instances of default skills were being applied for each logged in GM instead of only once on creation.

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
    - Morale is automatically applied to the final total. Detects Critical Failure ("snake eyes") when both the main kept die and LORE die show 1.
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


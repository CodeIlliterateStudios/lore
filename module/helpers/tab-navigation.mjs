/**
 * LoreTabNavigation encapsulates setup of primary tabs and gear sub-tabs for the Lore actor sheet.
 */
export class LoreTabNavigation {
  /**
   * @param {import('../sheets/actor-sheet.mjs').loreActorSheet} sheet
   */
  constructor(sheet) {
    this.sheet = sheet;
  }

  /**
   * Attach listeners and set initial tab state for both primary and gear sub-tabs.
   * Safe to call on each render.
   * @param {HTMLElement} rootEl
   */
  attach(rootEl) {
    if (!rootEl) return;

    // Gear sub-tabs (List / Paper Doll)
    try {
      const subNav = rootEl.querySelector('nav.tabs.sub-tabs[data-group="gear-sub"]');
      if (subNav) {
        const group = 'gear-sub';
        const current = this.sheet.tabGroups?.[group] ?? 'list';
        const sections = Array.from(rootEl.querySelectorAll('.sub-tab[data-group="gear-sub"]'));
        const links = Array.from(subNav.querySelectorAll('a.item[data-tab]'));

        const activate = (tabId) => {
          if (this.sheet.tabGroups) this.sheet.tabGroups[group] = tabId;
          for (const a of links) a.classList.toggle('active', a.dataset.tab === tabId);
          for (const s of sections) s.classList.toggle('active', s.dataset.tab === tabId);
        };

        const handler = (e) => {
          const a = e.target.closest('a.item[data-tab]');
          if (!a) return;
          e.preventDefault();
          activate(a.dataset.tab);
        };
        if (subNav._loreGearSubHandler) subNav.removeEventListener('click', subNav._loreGearSubHandler);
        subNav.addEventListener('click', handler);
        subNav._loreGearSubHandler = handler;

        activate(current);
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize Gear sub-tabs:', e);
    }

    // Details sub-tabs (Skills / Boons-Banes)
    try {
      const subNav = rootEl.querySelector('nav.tabs.sub-tabs[data-group="details-sub"]');
      if (subNav) {
        const group = 'details-sub';
        const current = this.sheet.tabGroups?.[group] ?? 'skills';
        const sections = Array.from(rootEl.querySelectorAll('.sub-tab[data-group="details-sub"]'));
        const links = Array.from(subNav.querySelectorAll('a.item[data-tab]'));

        const activate = (tabId) => {
          if (this.sheet.tabGroups) this.sheet.tabGroups[group] = tabId;
          for (const a of links) a.classList.toggle('active', a.dataset.tab === tabId);
          for (const s of sections) s.classList.toggle('active', s.dataset.tab === tabId);
        };

        const handler = (e) => {
          const a = e.target.closest('a.item[data-tab]');
          if (!a) return;
          e.preventDefault();
          activate(a.dataset.tab);
        };
        if (subNav._loreDetailsSubHandler) subNav.removeEventListener('click', subNav._loreDetailsSubHandler);
        subNav.addEventListener('click', handler);
        subNav._loreDetailsSubHandler = handler;

        activate(current);
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize Details sub-tabs:', e);
    }

    // Primary tabs (skills, gear, magicks, effects, biography)
    try {
      const primaryGroup = 'primary';
      const nav = rootEl.querySelector(`nav.tabs[data-group="${primaryGroup}"]`);
      if (nav) {
        const sections = Array.from(rootEl.querySelectorAll(`.tab[data-group="${primaryGroup}"]`));
        const links = Array.from(nav.querySelectorAll('a.main-tab[data-tab]'));

        const activate = (tabId) => {
          if (this.sheet.tabGroups) this.sheet.tabGroups[primaryGroup] = tabId;
          for (const a of links) a.classList.toggle('active', a.dataset.tab === tabId);
          for (const s of sections) s.classList.toggle('active', s.dataset.tab === tabId);
        };

        const handler = (e) => {
          const a = e.target.closest('a.main-tab[data-tab]');
          if (!a) return;
          e.preventDefault();
          activate(a.dataset.tab);
        };
        if (nav._lorePrimaryHandler) nav.removeEventListener('click', nav._lorePrimaryHandler);
        nav.addEventListener('click', handler);
        nav._lorePrimaryHandler = handler;

        const current = this.sheet.tabGroups?.[primaryGroup] ?? sections[0]?.dataset?.tab ?? 'biography';
        activate(current);
      }
    } catch (e) {
      console.warn('LORE | Failed to initialize primary tabs:', e);
    }
  }
}

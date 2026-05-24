/**
 * FlatableDetail.js
 * ─────────────────────────────────────────────────────────────────────
 * Conditional visibility on /flats/<slug> CMS template pages.
 *
 * What it hides when CMS data is missing:
 *   1. Hero "Age range" fact when min=0 AND max=0
 *   2. Hero "Student requirement" fact when empty
 *   3. About this flat card when ALL of {bio, amenities, vibes} are empty
 *      (and individually hides each sub-section that's empty)
 *   4. Looking For card when ALL of {bio, traits} are empty
 *      (and individually hides each sub-section that's empty)
 *   5. Household age-range fact when min=0 AND max=0
 *   6. Household gender row: individual genders with count 0 are hidden;
 *      whole row is hidden if all three counts are 0
 *
 * Also injects a flex layout on .lfg22__hh-facts so hidden facts collapse
 * cleanly (no empty grid cells leaving big gaps).
 *
 * Hosted at: https://cdn.jsdelivr.net/gh/Flatable/flatable-web-static@<sha>/FlatableDetail.js
 */
(() => {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const isZero = (val) => {
    const n = parseInt((val || '').trim(), 10);
    return isNaN(n) || n === 0;
  };
  const isEmpty = (val) => !val || !val.toString().trim();

  const hide = (el) => { if (el) el.style.display = 'none'; };

  // === Inject CSS: make .lfg22__hh-facts use flex so hidden items collapse ===
  const injectCss = () => {
    if (document.getElementById('lfb-detail-css')) return;
    const css = [
      '.lfg22__hh-facts{display:flex;flex-wrap:wrap;gap:24px 32px;align-items:flex-start}',
      '.lfg22__hh-fact{min-width:0}',
    ].join('');
    const s = document.createElement('style');
    s.id = 'lfb-detail-css';
    s.textContent = css;
    document.head.appendChild(s);
  };

  // === 1. Hero "Age range" fact ===
  const hideHeroAgeRangeIfEmpty = () => {
    $$('.lfh15-fact').forEach(fact => {
      const min = fact.querySelector('.lfh15-fact__age-min');
      const max = fact.querySelector('.lfh15-fact__age-max');
      if (min && max && isZero(min.textContent) && isZero(max.textContent)) {
        hide(fact);
      }
    });
  };

  // === 2. Hero "Student requirement" fact (and any other fact with empty value) ===
  const hideEmptyHeroFacts = () => {
    $$('.lfh15-fact').forEach(fact => {
      // Skip age range — handled above
      if (fact.querySelector('.lfh15-fact__age-min')) return;
      const val = fact.querySelector('.lfh15-fact__value');
      if (val && isEmpty(val.textContent)) hide(fact);
    });
  };

  // === Helpers for tag groups (Amenities / Vibes / Traits) ===
  // Each is a .lfg22__tag-group with a data-chips attribute (comma-separated).
  const tagGroupIsEmpty = (group) => !((group.getAttribute('data-chips') || '').trim());

  // Hide individual empty tag groups, return true if ALL provided groups are empty.
  const handleTagGroups = (card) => {
    const groups = $$('.lfg22__tag-group', card);
    let allEmpty = groups.length > 0;
    groups.forEach(g => {
      if (tagGroupIsEmpty(g)) hide(g);
      else allEmpty = false;
    });
    return allEmpty;
  };

  // Bio body — Webflow renders an empty <div class="w-richtext"></div> when
  // the rich-text CMS field is empty, OR a single empty <p>. Detect both.
  const bioIsEmpty = (card) => {
    const bio = card.querySelector('.w-richtext');
    if (!bio) return true;
    const text = (bio.textContent || '').trim();
    return text === '';
  };

  // === 3. About this flat ===
  const handleAboutCard = () => {
    const card = $('.lfg22__card--about');
    if (!card) return;
    const bioEmpty = bioIsEmpty(card);
    const allTagsEmpty = handleTagGroups(card);

    // Hide bio body if empty (keeps card visible if tags exist)
    if (bioEmpty) {
      const richtext = card.querySelector('.w-richtext');
      if (richtext) hide(richtext);
    }

    if (bioEmpty && allTagsEmpty) {
      hide(card);
    }
  };

  // === 4. Looking For ===
  const handleLookingForCard = () => {
    const card = $('.lfg22__card--lookingfor');
    if (!card) return;
    const bioEmpty = bioIsEmpty(card);
    const allTagsEmpty = handleTagGroups(card);

    if (bioEmpty) {
      const richtext = card.querySelector('.w-richtext');
      if (richtext) hide(richtext);
    }

    if (bioEmpty && allTagsEmpty) {
      hide(card);
    }
  };

  // === 5 + 6. Household: age range + gender ===
  const handleHousehold = () => {
    const card = $('.lfg22__card--household');
    if (!card) return;

    // Age range: find the hh-fact that contains __age-min
    const ageFact = $$('.lfg22__hh-fact', card).find(f => f.querySelector('.lfh15-fact__age-min'));
    if (ageFact) {
      const min = ageFact.querySelector('.lfh15-fact__age-min');
      const max = ageFact.querySelector('.lfh15-fact__age-max');
      if (min && max && isZero(min.textContent) && isZero(max.textContent)) {
        hide(ageFact);
      }
    }

    // Gender: hide individual zero-count icons; hide whole row if all zero
    const genderRow = $('.lfg22__hh-gender', card);
    if (genderRow) {
      const items = $$('.lfg22__hh-g', genderRow);
      let visibleCount = 0;
      items.forEach(item => {
        const numEl = item.querySelector('.lfg22__hh-g-numv');
        if (numEl && isZero(numEl.textContent)) {
          hide(item);
        } else {
          visibleCount++;
        }
      });
      if (visibleCount === 0) {
        const genderFact = genderRow.closest('.lfg22__hh-fact');
        if (genderFact) hide(genderFact);
        else hide(genderRow);
      }
    }
  };

  // === Boot ===
  const boot = () => {
    injectCss();
    hideHeroAgeRangeIfEmpty();
    hideEmptyHeroFacts();
    handleAboutCard();
    handleLookingForCard();
    handleHousehold();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

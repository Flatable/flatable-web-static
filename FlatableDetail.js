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
    const card = $('.lfg22__card--looking');
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

  // === 7. Apply CTA — universal smart link ===
  // App Store ID resolved 2026-05-24 via iTunes lookup for bundleId com.flatable.
  const APP_STORE_URL = 'https://apps.apple.com/app/id6749847670';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.flatable';
  const APPLE_SVG_PATH = 'M16.365 1.43c0 1.14-.42 2.21-1.14 3.03-.86.97-2.27 1.71-3.45 1.62-.15-1.14.42-2.34 1.14-3.09.81-.86 2.24-1.49 3.45-1.56zM20.84 17.21c-.6 1.41-.89 2.04-1.66 3.28-1.07 1.74-2.58 3.91-4.45 3.93-1.66.02-2.08-1.08-4.33-1.07-2.25.01-2.71 1.09-4.37 1.07-1.87-.02-3.3-1.98-4.37-3.72-2.99-4.86-3.31-10.56-1.46-13.59 1.31-2.15 3.39-3.41 5.34-3.41 1.99 0 3.24 1.09 4.89 1.09 1.6 0 2.57-1.09 4.87-1.09 1.74 0 3.58.95 4.88 2.59-4.3 2.36-3.6 8.48.66 10.92z';
  const PLAY_SVG_PATH = 'M3.6 1.7c-.4.4-.6.9-.6 1.5v17.6c0 .6.2 1.1.6 1.5l9.7-10.3L3.6 1.7zm10.7 11.4 2.6 2.7-11.6 6.6 9-9.3zm0-2.2-9-9.3 11.6 6.6-2.6 2.7zm6.3 1.1L17.8 14l-2.7-2.9 2.7-2.9 2.8 1.6c.9.5.9 1.6 0 2.1z';

  const detectPlatform = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  };

  const injectApplyModalCss = () => {
    if (document.getElementById('lf-apply-modal-css')) return;
    const css = document.createElement('style');
    css.id = 'lf-apply-modal-css';
    css.textContent = [
      '.lf-apply-modal__backdrop{position:fixed;inset:0;background:rgba(20,12,8,0.55);',
        'display:none;align-items:center;justify-content:center;z-index:9998;',
        'opacity:0;transition:opacity 180ms ease}',
      '.lf-apply-modal__backdrop.is-open{display:flex;opacity:1}',
      '.lf-apply-modal{background:#fff;border-radius:24px;max-width:440px;width:calc(100% - 32px);',
        'padding:32px 28px 28px;box-shadow:0 24px 64px rgba(40,12,4,0.25);',
        'transform:translateY(8px);transition:transform 220ms ease;z-index:9999;text-align:center;',
        'font-family:inherit;position:relative}',
      '.lf-apply-modal__backdrop.is-open .lf-apply-modal{transform:translateY(0)}',
      '.lf-apply-modal__title{font-size:24px;font-weight:700;margin:0 0 8px;color:#231510}',
      '.lf-apply-modal__sub{font-size:15px;line-height:1.45;margin:0 0 24px;color:#5a3f33}',
      '.lf-apply-modal__buttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}',
      '.lf-apply-modal__btn{display:inline-flex;align-items:center;gap:8px;background:#000;color:#fff;',
        'border-radius:14px;padding:14px 18px;text-decoration:none;font-weight:600;font-size:15px;',
        'transition:transform 120ms ease,box-shadow 120ms ease}',
      '.lf-apply-modal__btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,0.18)}',
      '.lf-apply-modal__btn svg{width:22px;height:22px;flex:0 0 22px;fill:currentColor}',
      '.lf-apply-modal__btn-meta{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}',
      '.lf-apply-modal__btn-meta-sm{font-size:10px;font-weight:500;opacity:0.85;letter-spacing:0.04em;text-transform:uppercase}',
      '.lf-apply-modal__btn-meta-lg{font-size:16px;font-weight:700}',
      '.lf-apply-modal__close{position:absolute;top:14px;right:16px;background:none;border:0;',
        'font-size:24px;line-height:1;color:#a17260;cursor:pointer;padding:4px 8px}',
      '.lf-apply-modal__close:hover{color:#231510}'
    ].join('\n');
    document.head.appendChild(css);
  };

  // Build an SVG icon node from a path string (avoids innerHTML).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const buildIcon = (pathD) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  };

  const buildStoreButton = (href, iconPath, smText, lgText) => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'lf-apply-modal__btn';
    a.appendChild(buildIcon(iconPath));
    const meta = document.createElement('span');
    meta.className = 'lf-apply-modal__btn-meta';
    const sm = document.createElement('span');
    sm.className = 'lf-apply-modal__btn-meta-sm';
    sm.textContent = smText;
    const lg = document.createElement('span');
    lg.className = 'lf-apply-modal__btn-meta-lg';
    lg.textContent = lgText;
    meta.appendChild(sm);
    meta.appendChild(lg);
    a.appendChild(meta);
    return a;
  };

  const buildApplyModal = () => {
    const existing = document.getElementById('lf-apply-modal');
    if (existing) return existing;
    injectApplyModalCss();
    const backdrop = document.createElement('div');
    backdrop.id = 'lf-apply-modal';
    backdrop.className = 'lf-apply-modal__backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'lf-apply-modal-title');

    const modal = document.createElement('div');
    modal.className = 'lf-apply-modal';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lf-apply-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    const title = document.createElement('h2');
    title.id = 'lf-apply-modal-title';
    title.className = 'lf-apply-modal__title';
    title.textContent = 'Apply in the Flatable app';

    const sub = document.createElement('p');
    sub.className = 'lf-apply-modal__sub';
    sub.textContent = 'Applications happen in the Flatable mobile app. Install it to message this flat’s tenants and apply.';

    const buttons = document.createElement('div');
    buttons.className = 'lf-apply-modal__buttons';
    buttons.appendChild(buildStoreButton(APP_STORE_URL, APPLE_SVG_PATH, 'Download on the', 'App Store'));
    buttons.appendChild(buildStoreButton(PLAY_STORE_URL, PLAY_SVG_PATH, 'Get it on', 'Google Play'));

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(sub);
    modal.appendChild(buttons);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const close = () => backdrop.classList.remove('is-open');
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    return backdrop;
  };

  const openApplyModal = () => {
    const m = buildApplyModal();
    m.classList.add('is-open');
  };

  const wireApplyButton = () => {
    const apply = document.querySelector('.lf-bar__apply');
    if (!apply) return;
    apply.addEventListener('click', (e) => {
      e.preventDefault();
      const platform = detectPlatform();
      if (platform === 'ios') {
        window.location.href = APP_STORE_URL;
        return;
      }
      if (platform === 'android') {
        window.location.href = PLAY_STORE_URL;
        return;
      }
      openApplyModal();
    });
  };

  // === Boot ===
  const boot = () => {
    injectCss();
    hideHeroAgeRangeIfEmpty();
    hideEmptyHeroFacts();
    handleAboutCard();
    handleLookingForCard();
    handleHousehold();
    wireApplyButton();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

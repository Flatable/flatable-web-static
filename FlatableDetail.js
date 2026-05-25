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
      // Vertically center the gender icon/number triplets — they were sitting on the
      // top border because the row defaults to align-items: flex-start.
      // Gender row mirrors the height of the sibling h6 values (Flatmates,
      // Age range). The inline-flex inner h6 defaults to line-height 1, which
      // squashes the row to 17px vs the regular h6's ~22.1px and pushes this
      // column up. Explicit line-height matches Webflow's default h6.
      '.lfg22__hh-gender{display:flex;align-items:center;gap:14px}',
      '.lfg22__hh-g{display:inline-flex;align-items:center;gap:6px}',
      '.lfg22__hh-g-num{margin:0;display:inline-flex;align-items:center}',
      '.lfg22__hh-g-numv{margin:0;line-height:1.3!important}',
      // Tenancy badge — orange outline only, no fill.
      '.lfh15__badge{background:transparent!important;background-color:transparent!important;',
        'border:1px solid #ff5e3a!important;color:#ff5e3a!important;font-weight:600}',
      // Tag chips on detail page — orange gradient + white text (match map marker hover).
      '.lfg22__chip{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'color:#fff!important;border-color:transparent!important;display:inline-flex;',
        'align-items:center;gap:6px}',
      '.lfg22__chip .lf-chip__emoji{font-size:1em;line-height:1;flex:0 0 auto}',
      // Photo container shows white (matching page bg) during the brief gap
      // while the next carousel image loads — no peachy flash.
      '.lfh15__photo{background:#fff!important;background-color:#fff!important}',
      // === MOBILE (≤767px) — scoped overrides ONLY. Desktop untouched. ===
      '@media (max-width:767px){',
      // Hero primary row (rent / size / dates): wrap so rent+size sit on row 1
      // and the combined "from … till …" dates stat drops to row 2.
      // Child order: stat[rent], sep, stat[size], sep, stat[dates] → indices 1..5.
      '.lfh15__primary{flex-wrap:wrap!important;row-gap:6px!important;align-items:baseline!important}',
      '.lfh15__primary>*:nth-child(4){display:none!important}',
      '.lfh15__primary>*:nth-child(5){flex-basis:100%!important;margin-top:4px!important;',
      'color:#5a3f33!important;font-size:0.95em!important}',
      // Secondary facts (Furnished / Utilities / Flatmates / Free rooms / Student req
      // and the hidden Age range): two-column grid.
      '.lfh15-facts{display:grid!important;grid-template-columns:1fr 1fr!important;',
      'gap:16px 12px!important;width:100%!important;align-items:start!important}',
      '.lfh15-fact{width:auto!important;min-width:0!important}',
      '}',
      // Active carousel dash uses brand orange (overrides HeroSlider inline white).
      '.lfh15__photo-dot[aria-current="true"]{',
        'background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important}',
      // Brand brighter orange replaces the muted brown on these elements.
      '.lfh15__kicker{color:#ff5e3a!important}',
      '.lfg22__hh-g-icon{color:#ff5e3a!important;fill:#ff5e3a!important}',
      // Apply is the primary CTA: orange-filled background, white text/icon.
      '.lf-bar__apply{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'background-image:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'color:#fff!important;border:1.5px solid transparent!important}',
      '.lf-bar__apply .lf-bar__apply-icon,.lf-bar__apply span{color:#fff!important}',
      // Skip is the secondary CTA: white fill, default text.
      '.lf-bar__skip{background:#fff!important;background-image:none!important}',
      // The whole sticky bar wrapper goes white so the Skip pill no longer
      // sits on top of a cream tint (which broke the white-on-white intent).
      '.lf-bar-1-2{background:#fff!important;background-image:none!important}',
      // Lightbox — fullscreen photo viewer.
      '.lf-photo-cursor{cursor:zoom-in}',
      '.lf-lightbox{position:fixed;inset:0;background:rgba(8,4,2,0.92);display:none;',
        'align-items:center;justify-content:center;z-index:10000;padding:24px}',
      '.lf-lightbox.is-open{display:flex}',
      '.lf-lightbox__img{max-width:95vw;max-height:90vh;object-fit:contain;',
        'box-shadow:0 24px 60px rgba(0,0,0,0.4);border-radius:12px}',
      '.lf-lightbox__btn{position:absolute;top:50%;transform:translateY(-50%);',
        'width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.15);',
        'border:0;color:#fff;font-size:28px;cursor:pointer;display:inline-flex;',
        'align-items:center;justify-content:center;line-height:1;font-family:inherit;',
        'transition:background 160ms ease}',
      '.lf-lightbox__btn:hover{background:rgba(255,255,255,0.3)}',
      '.lf-lightbox__btn--prev{left:24px}.lf-lightbox__btn--next{right:24px}',
      '.lf-lightbox__close{position:absolute;top:24px;right:24px;width:44px;height:44px;',
        'border-radius:50%;background:rgba(255,255,255,0.15);border:0;color:#fff;',
        'font-size:26px;cursor:pointer;display:inline-flex;align-items:center;',
        'justify-content:center;line-height:1;font-family:inherit;padding:0}',
      '.lf-lightbox__close:hover{background:rgba(255,255,255,0.3)}',
      '.lf-lightbox__count{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);',
        'color:#fff;font-size:14px;background:rgba(0,0,0,0.4);padding:6px 14px;border-radius:999px;',
        'font-variant-numeric:tabular-nums}'
    ].join('');
    const s = document.createElement('style');
    s.id = 'lfb-detail-css';
    s.textContent = css;
    document.head.appendChild(s);
  };

  // === Emoji map for tag chips ===
  // Canonical list from `lib/v2/core/models/emoji_model.dart`. Unknown values
  // fall through with no emoji (cleaner than identical fallbacks).
  // Mirrored in FlatableBrowse.js — keep both copies aligned.
  const TAG_EMOJI = {
    'social butterfly': '🦋', 'outgoing': '🎤', 'more introverted': '🤓',
    'quiet thinker': '🧠', 'easy-going': '😎',
    'a bit messy': '🌀', 'clean freak': '🧼', 'tidy': '✨', "doesn't mind chaos": '🌪️',
    'out most days': '🚶', 'night owl': '🦉', 'flexible schedule': '🕐',
    'early bird': '🌅', 'work-from-home': '💻',
    'active': '💪', 'chill': '🌴', 'foodie': '🍴', 'party-friendly': '🥳',
    'eco-conscious': '🌱', 'pet lover': '🐾',
    'calm': '🌙', 'reliable': '🤝', 'spontaneous': '💫', 'creative': '🎨',
    'organized': '📋', 'adventurous': '🧗',
    'everyone does their thing': '🍃', 'like a small family': '👨‍👩‍👧',
    'open for deep talks': '💬', 'chill but connected': '☕',
    'quiet & peaceful': '🤫', 'fun & lively': '🎉',
    'calm weekdays, social weekends': '🌗',
    'calm weekdays': '🌅', 'social weekends': '🎉',
    'shared dinners': '🍽️', 'movie nights': '🎬', 'yoga or workouts': '🧘',
    'occasional drinks': '🍷', 'weekend adventures': '🏞️',
    'non-smoker': '🚭', 'pet-friendly': '🐶', 'visitors welcome': '👋',
    'respectful of space': '🙏', 'clean shared areas': '🧹',
    'food': '🍴', 'travel': '✈️', 'movies': '🎬', 'diy': '🔨', 'gardening': '🌷',
    'art': '🎨', 'photography': '📷', 'sports': '⚽', 'music': '🎵',
    'cooking': '🍳', 'reading': '📖', 'dancing': '💃', 'fitness': '🏋️',
    'coding': '👨‍💻', 'gaming': '🎮',
    'wi-fi': '📶', 'garden': '🌿', 'balcony': '☀️', 'parking': '🚗',
    'laundry room': '🧺', 'dishwasher': '🍽️', 'smoking allowed': '🚬',
    'pets allowed': '🐾'
  };
  const emojiFor = (text) => {
    const key = (text || '').trim().toLowerCase();
    if (!key) return null;
    return TAG_EMOJI[key] || null;
  };

  // Prepend an emoji span to every detail-page chip exactly once.
  // Languages and flatmate professions live inside the Household card; they're
  // factual roster data, not personality tags, so we skip emoji decoration there.
  const decorateChips = () => {
    document.querySelectorAll('.lfg22__chip').forEach((chip) => {
      if (chip.closest('.lfg22__card--household')) return;
      if (chip.querySelector('.lf-chip__emoji')) return;
      const original = chip.textContent.trim();
      if (!original) return;
      const emoji = emojiFor(original);
      if (!emoji) return;
      const span = document.createElement('span');
      span.className = 'lf-chip__emoji';
      span.textContent = emoji;
      chip.insertBefore(span, chip.firstChild);
    });
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
  const COUNTDOWN_START = 3;
  const COUNTDOWN_TICK_MS = 1000;

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
      '.lf-apply-modal{background:#fff;border-radius:24px;max-width:480px;width:calc(100% - 32px);',
        'padding:36px 32px 24px;box-shadow:0 24px 64px rgba(40,12,4,0.25);',
        'transform:translateY(8px);transition:transform 220ms ease;z-index:9999;text-align:center;',
        'font-family:inherit;position:relative}',
      '.lf-apply-modal__backdrop.is-open .lf-apply-modal{transform:translateY(0)}',
      '.lf-apply-modal__title{font-size:26px;font-weight:700;line-height:1.2;margin:0 0 12px;color:#231510}',
      '.lf-apply-modal__sub{font-size:15px;line-height:1.5;margin:0 0 24px;color:#5a3f33}',
      '.lf-apply-modal__sub strong{color:#ff5e3a;font-variant-numeric:tabular-nums}',
      // Equal-width store buttons (desktop + mobile). Both flex:1 with same
      // max so the App Store and Google Play pills mirror each other.
      '.lf-apply-modal__buttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}',
      '.lf-apply-modal__btn{display:inline-flex;align-items:center;justify-content:flex-start;',
        'gap:8px;background:#000;color:#fff;',
        'border-radius:14px;padding:14px 18px;text-decoration:none;font-weight:600;font-size:15px;',
        'transition:transform 120ms ease,box-shadow 120ms ease;',
        'flex:1 1 0;min-width:0;max-width:200px;box-sizing:border-box}',
      // Mobile: stack the two store buttons vertically, each full-width and
      // matching height, so the modal stays comfortable on small screens.
      '@media (max-width:767px){',
        '.lf-apply-modal__buttons{flex-direction:column!important;align-items:stretch!important}',
        '.lf-apply-modal__btn{flex:0 0 auto!important;max-width:none!important;width:100%!important;',
          'min-height:64px!important}',
      '}',
      '.lf-apply-modal__btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,0.18)}',
      '.lf-apply-modal__btn svg{width:22px;height:22px;flex:0 0 22px;fill:currentColor}',
      '.lf-apply-modal__btn-meta{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}',
      '.lf-apply-modal__btn-meta-sm{font-size:10px;font-weight:500;opacity:0.85;letter-spacing:0.04em;text-transform:uppercase}',
      '.lf-apply-modal__btn-meta-lg{font-size:16px;font-weight:700}',
      '.lf-apply-modal__close{position:absolute;top:14px;right:16px;background:none;border:0;',
        'font-size:24px;line-height:1;color:#a17260;cursor:pointer;padding:4px 8px}',
      '.lf-apply-modal__close:hover{color:#231510}',
      '.lf-apply-modal__disclaimer{font-size:11px;line-height:1.4;color:#9a8275;margin:0}',
      // Hero heart save toggle (detail page).
      '.lf-hero-save{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;',
        'background:rgba(255,255,255,0.9);border:0;display:inline-flex;align-items:center;justify-content:center;',
        'cursor:pointer;z-index:5;color:#5a3f33;backdrop-filter:blur(6px);',
        'box-shadow:0 4px 12px rgba(20,12,8,0.18);transition:background 160ms ease,color 160ms ease,transform 120ms ease}',
      '.lf-hero-save:hover{transform:scale(1.06)}',
      '.lf-hero-save.is-saved{background:linear-gradient(135deg,#ff8b3d,#ff5e3a);color:#fff}',
      '.lf-hero-save svg{width:22px;height:22px}',
      '.lf-hero-save.is-saved svg{fill:#fff;stroke:#fff}'
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

  // Modal state lives on the backdrop element so reopens cancel any leftover
  // countdown from a previous open (e.g. user closed mid-countdown).
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
    title.textContent = 'One match away from your new home';

    const sub = document.createElement('p');
    sub.id = 'lf-apply-modal-sub';
    sub.className = 'lf-apply-modal__sub';

    const buttons = document.createElement('div');
    buttons.className = 'lf-apply-modal__buttons';
    buttons.appendChild(buildStoreButton(APP_STORE_URL, APPLE_SVG_PATH, 'Download on the', 'App Store'));
    buttons.appendChild(buildStoreButton(PLAY_STORE_URL, PLAY_SVG_PATH, 'Get it on', 'Google Play'));

    const disclaimer = document.createElement('p');
    disclaimer.className = 'lf-apply-modal__disclaimer';
    disclaimer.textContent = 'The webapp is in development and will be published soon.';

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(sub);
    modal.appendChild(buttons);
    modal.appendChild(disclaimer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.classList.remove('is-open');
      stopCountdown(backdrop);
    };
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    return backdrop;
  };

  const stopCountdown = (backdrop) => {
    if (backdrop._lfCountdownTimer) {
      clearInterval(backdrop._lfCountdownTimer);
      backdrop._lfCountdownTimer = null;
    }
  };

  const renderSubLine = (sub, secondsLeft, platform) => {
    while (sub.firstChild) sub.removeChild(sub.firstChild);
    sub.appendChild(document.createTextNode('Apply for this flat on Flatable. '));
    if (secondsLeft > 0 && platform !== 'desktop') {
      sub.appendChild(document.createTextNode('You will be redirected in '));
      const num = document.createElement('strong');
      num.textContent = String(secondsLeft) + '…';
      sub.appendChild(num);
    } else if (platform === 'desktop') {
      sub.appendChild(document.createTextNode('Open Flatable on iOS or Android ↓'));
    } else {
      sub.appendChild(document.createTextNode('Opening the store…'));
    }
  };

  const startCountdown = (backdrop) => {
    const platform = detectPlatform();
    const sub = backdrop.querySelector('#lf-apply-modal-sub');
    if (!sub) return;
    let n = COUNTDOWN_START;
    renderSubLine(sub, n, platform);
    stopCountdown(backdrop);
    if (platform === 'desktop') return;
    backdrop._lfCountdownTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        stopCountdown(backdrop);
        renderSubLine(sub, 0, platform);
        const target = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
        window.location.href = target;
        return;
      }
      renderSubLine(sub, n, platform);
    }, COUNTDOWN_TICK_MS);
  };

  const openApplyModal = () => {
    const m = buildApplyModal();
    m.classList.add('is-open');
    startCountdown(m);
  };

  const wireApplyButton = () => {
    const apply = document.querySelector('.lf-bar__apply');
    if (!apply) return;
    apply.addEventListener('click', (e) => {
      e.preventDefault();
      openApplyModal();
    });
  };

  // === 7b. Hero heart — toggles the same localStorage saved-set as browse cards ===
  const SAVED_KEY = 'flatable.savedFlats';
  const HEART_OUTLINE = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z';

  const readSaved = () => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch (e) {
      return new Set();
    }
  };
  const writeSaved = (set) => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* */ }
  };

  const buildHeroHeart = () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lf-hero-save';
    btn.setAttribute('aria-label', 'Save this flat');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', HEART_OUTLINE);
    svg.appendChild(path);
    btn.appendChild(svg);
    return btn;
  };

  // === 7c. Hero photo lightbox (fullscreen viewer) ===
  // Clicking the photo (or its image) opens a fullscreen carousel. Prev/Next
  // step through every URL in the data-photos comma list. Esc / × closes.
  const buildLightbox = (urls) => {
    const existing = document.getElementById('lf-lightbox');
    if (existing) return existing;
    const root = document.createElement('div');
    root.id = 'lf-lightbox';
    root.className = 'lf-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    const img = document.createElement('img');
    img.className = 'lf-lightbox__img';
    img.alt = '';
    root.appendChild(img);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lf-lightbox__close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    root.appendChild(close);

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'lf-lightbox__btn lf-lightbox__btn--prev';
    prev.setAttribute('aria-label', 'Previous photo');
    prev.textContent = '‹';
    root.appendChild(prev);

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'lf-lightbox__btn lf-lightbox__btn--next';
    next.setAttribute('aria-label', 'Next photo');
    next.textContent = '›';
    root.appendChild(next);

    const count = document.createElement('div');
    count.className = 'lf-lightbox__count';
    root.appendChild(count);

    document.body.appendChild(root);

    let idx = 0;
    const render = () => {
      img.src = urls[idx];
      count.textContent = (idx + 1) + ' / ' + urls.length;
      const multi = urls.length > 1;
      prev.style.display = multi ? '' : 'none';
      next.style.display = multi ? '' : 'none';
      count.style.display = multi ? '' : 'none';
    };
    const closeLb = () => {
      root.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    const openLb = (startIdx) => {
      idx = Math.max(0, Math.min(startIdx || 0, urls.length - 1));
      render();
      root.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };
    const step = (delta) => {
      idx = (idx + delta + urls.length) % urls.length;
      render();
    };

    close.addEventListener('click', closeLb);
    prev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    root.addEventListener('click', (e) => { if (e.target === root) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (!root.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });

    root._open = openLb;
    return root;
  };


  const wireLightbox = () => {
    const photo = document.querySelector('.lfh15__photo');
    if (!photo) return;
    const photosAttr = photo.getAttribute('data-photos') || '';
    const urls = photosAttr.split(',').map(s => s.trim()).filter(Boolean);
    if (!urls.length) return;
    const lb = buildLightbox(urls);
    photo.classList.add('lf-photo-cursor');

    const findCurrentIndex = () => {
      const live = photo.querySelector('.lfh15__photo-img');
      if (!live) return 0;
      const i = urls.indexOf(live.getAttribute('src'));
      return i >= 0 ? i : 0;
    };

    photo.addEventListener('click', (e) => {
      // Don't hijack the prev/next nav buttons; they cycle the inline carousel.
      if (e.target.closest('.lfh15__photo-nav') || e.target.closest('.lfh15__photo-dot')) return;
      e.preventDefault();
      lb._open(findCurrentIndex());
    });
  };

  const wireHeroHeart = () => {
    // Anchor on the photo container so the heart sits on the image, not the
    // full-width hero band. Falls back to .lfh15 only if photo is missing.
    const hero = document.querySelector('.lfh15__photo') || document.querySelector('.lfh15');
    if (!hero) return;
    if (hero.querySelector('.lf-hero-save')) return;
    const slug = currentSlug();
    if (!slug) return;

    // The hero must be a positioning context so absolute-positioned heart anchors correctly.
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';

    const btn = buildHeroHeart();
    const saved = readSaved();
    if (saved.has(slug)) btn.classList.add('is-saved');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const set = readSaved();
      if (set.has(slug)) {
        set.delete(slug);
        btn.classList.remove('is-saved');
      } else {
        set.add(slug);
        btn.classList.add('is-saved');
      }
      writeSaved(set);
    });

    hero.appendChild(btn);
  };

  // === 8. Skip — advance through the persisted browse list ===
  // Detail page URL: /flats/<slug>. Current slug is the last path segment.
  const currentSlug = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  const readBrowseList = () => {
    try {
      const raw = localStorage.getItem('flatable.browseList');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.slugs)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  };

  const nextSlug = (slug) => {
    const list = readBrowseList();
    if (!list || !list.slugs.length) return null;
    const idx = list.slugs.indexOf(slug);
    if (idx === -1) return null;
    if (idx >= list.slugs.length - 1) return null;
    return list.slugs[idx + 1];
  };

  const wireSkipButton = () => {
    const skip = document.querySelector('.lf-bar__skip');
    if (!skip) return;
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      const next = nextSlug(currentSlug());
      window.location.href = next ? '/flats/' + next : '/browse-flats';
    });
  };

  // === Boot ===
  const boot = () => {
    injectCss();
    // Hero heart styles live inside the apply-modal CSS bundle; inject up-front
    // so the heart is sized correctly on first paint (it's created in wireHeroHeart
    // before the modal is ever opened).
    injectApplyModalCss();
    hideHeroAgeRangeIfEmpty();
    hideEmptyHeroFacts();
    handleAboutCard();
    handleLookingForCard();
    handleHousehold();
    wireApplyButton();
    wireSkipButton();
    wireHeroHeart();
    wireLightbox();
    decorateChips();
  };

  // bfcache: when the user hits back into a cached detail page, refresh the
  // hero heart visual to match localStorage (state could have changed elsewhere).
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    const heart = document.querySelector('.lf-hero-save');
    if (!heart) return;
    const slug = currentSlug();
    const saved = readSaved();
    heart.classList.toggle('is-saved', !!slug && saved.has(slug));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

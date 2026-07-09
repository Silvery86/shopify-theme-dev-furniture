# Frontend UX Review: Animations, Micro-interactions & Performance

**Theme:** Dawn-based furniture storefront with custom Tailwind sections  
**Review date:** July 2026  
**Philosophy:** HTML-first, CSS transitions, native Web APIs — no heavy animation libraries

---

## Executive Summary

This theme inherits Dawn's solid animation foundation (`animations.js`, CSS custom-property timing tokens, drawer patterns, and theme-editor settings for scroll reveal and hover effects). Custom homepage and collection sections built with Tailwind and Swiper add visual polish in places, but they are **not integrated** with Dawn's animation system and introduce several **CLS (Cumulative Layout Shift)** and **jank** risks.

The highest-impact improvements are:

1. Extend Dawn's existing `scroll-trigger` pattern to custom sections (zero new dependencies).
2. Fix layout-shift sources in the header, product cards, and facet filtering.
3. Add lightweight image fade-in and reserved-space patterns.
4. Polish drawer/modal/accordion transitions using CSS already present in Dawn.
5. Audit invalid Tailwind utility classes that silently fail.

---

## Current State

### What Dawn Already Provides (keep and extend)

| Capability | Location | Notes |
|---|---|---|
| Scroll reveal (fade/slide) | `assets/animations.js`, `assets/base.css` | Intersection Observer, cascade via `--animation-order` |
| Hover lift / 3D lift | `assets/base.css`, `settings.animations_hover_elements` | Applied via `body.animate--hover-*` class |
| Product card image hover | `assets/component-card.css` | Scale + secondary image crossfade (desktop only) |
| Menu drawer slide | `assets/component-menu-drawer.css`, `assets/global.js` | `menu-opening` class + `transform` transition |
| Cart drawer slide | `assets/component-cart-drawer.css`, `assets/cart-drawer.js` | `translateX` panel + overlay |
| Accordion caret | `assets/component-accordion.css` | Instant `rotate(180deg)` on `[open]` |
| Reduced motion | `assets/base.css`, `assets/animations.js` | `@media (prefers-reduced-motion)` guards |
| Duration tokens | `:root` in `assets/base.css` | `--duration-short` through `--duration-extra-long` |

Scroll animations are gated by the theme setting `animations_reveal_on_scroll` and loaded conditionally in `layout/theme.liquid`.

### What Custom Code Adds

| Section / file | Approach | Gap |
|---|---|---|
| `sections/header-main.liquid` | Tailwind transitions, custom mobile drawer | Duplicates Dawn drawer; causes CLS on load |
| `sections/popular_products.liquid` | Swiper carousel + `custom-product-card` | No scroll reveal; Swiper is ~40KB+ |
| `sections/hero-slider.liquid` | Swiper + dynamic price/title fetch | Text content shifts on slide change |
| `sections/categories-list.liquid` | Tailwind hover micro-interactions | Invalid `duration-600` class; no lazy load |
| `sections/benefits.liquid` | Tailwind `hover:scale-120` | Invalid scale utility; no scroll reveal |
| `snippets/custom-product-card.liquid` | Opacity crossfade on hover | Missing image load fade; dimension mismatch |
| `sections/quick-add-to-cart-modal.liquid` | Bottom sheet modal | Good structure; overlay not animated in |

---

## 1. Section & Page Load Transitions

### 1.1 Extend Dawn scroll-trigger to custom sections (Recommended)

Dawn sections already use this pattern:

```liquid
{% if settings.animations_reveal_on_scroll %}
  scroll-trigger animate--slide-in
{% endif %}
```

**Apply to custom sections** that currently have no entrance animation:

- `sections/popular_products.liquid` — heading + slider container
- `sections/categories-list.liquid` — each `.category-item` with cascade
- `sections/benefits.liquid` — each `.benefit__container`
- `sections/hero-slider.liquid` — hero content block
- `sections/best-deal-banner.liquid`, `sections/gallery.liquid`, `sections/recent-viewed.liquid`

**Example — `popular_products.liquid`:**

```liquid
<div class="heading__title ...{% if settings.animations_reveal_on_scroll %} scroll-trigger animate--slide-in{% endif %}">
  {{ section.settings['popular-products__title'] }}
</div>

<div
  class="swiper popular-products__slider ...{% if settings.animations_reveal_on_scroll %} scroll-trigger animate--slide-in{% endif %}"
  {% if settings.animations_reveal_on_scroll %}
    data-cascade
    style="--animation-order: 1;"
  {% endif %}
>
```

**Example — `categories-list.liquid` (cascade per item):**

```liquid
<div
  class="category-item{% if settings.animations_reveal_on_scroll %} scroll-trigger animate--slide-in{% endif %}"
  {% if settings.animations_reveal_on_scroll %}
    data-cascade
    style="--animation-order: {{ forloop.index }};"
  {% endif %}
  {{ block.shopify_attributes }}
>
```

**Why it helps:** Reuses existing `animations.js` (already loaded when the setting is on). No new JS. Respects `prefers-reduced-motion` via Dawn's CSS guards.

### 1.2 Staggered grid reveal utility (optional, small addition)

For product grids rendered via AJAX (facets), re-initialize the observer after DOM swap. `facets.js` already attempts this but passes a string instead of a DOM node — fix below in §5.

**Add to `assets/animations.js`:**

```js
// After facet/AJAX renders, call:
function initializeScrollAnimationTrigger(rootEl = document) {
  // existing implementation — ensure rootEl is an Element, not innerHTML string
}
```

**Fix in `assets/facets.js` (lines ~70, ~79):**

```js
// Before (broken — passes HTML string):
initializeScrollAnimationTrigger(html.innerHTML);

// After:
const grid = document.getElementById('ProductGridContainer');
if (grid && typeof initializeScrollAnimationTrigger === 'function') {
  initializeScrollAnimationTrigger(grid);
}
```

### 1.3 Page-level fade for custom header (reduce CLS)

`header-main.liquid` hides the header until JS runs:

```html
class="... -translate-y-4 opacity-0 transition-all duration-300 ..."
```

This causes a visible layout jump and delays LCP perception.

**Refactor — CSS-only initial state with progressive enhancement:**

```liquid
<div
  id="headerMain"
  class="w-full z-20 header-main--enter"
>
```

```css
/* assets/section-header-main.css (new, small file) */
.header-main--enter {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: no-preference) {
  .js .header-main--enter {
    opacity: 0;
    transform: translateY(-1rem);
    transition: opacity var(--duration-medium) var(--ease-out-slow),
                transform var(--duration-medium) var(--ease-out-slow);
  }

  .js .header-main--enter.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

```js
// Replace requestAnimationFrame block in header-main.liquid
document.getElementById('headerMain')?.classList.add('is-visible');
```

**Why it helps:** Non-JS users see the header immediately. JS users get a smooth entrance without blocking paint.

---

## 2. Hover Micro-interactions

### 2.1 Custom product cards — image zoom + lift

Dawn's `card-product.liquid` uses `media--hover-effect` for a subtle `scale(1.03)`. Custom cards only crossfade opacity.

**Enhance `snippets/custom-product-card.liquid`:**

```liquid
<div class="product__image relative overflow-hidden group">
  <a href="{{ card_product.url }}" class="block">
    <img
      class="product-main-image w-full object-cover aspect-[2/1] transition-[opacity,transform] duration-500 ease-out group-hover:opacity-0 group-hover:scale-[1.03]"
      ...
    >
    <img
      class="product-secondary-image absolute inset-0 w-full object-cover opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover:opacity-100 group-hover:scale-[1.03] aspect-[2/1]"
      ...
    >
  </a>
</div>
```

**Add card lift on desktop (respect reduced motion):**

```css
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .product_container {
    transition: transform var(--duration-long) ease, box-shadow var(--duration-long) ease;
  }
  .product_container:hover {
    transform: translateY(-0.4rem);
    box-shadow: 0 1.2rem 2.4rem -1.2rem rgba(0, 0, 0, 0.12);
  }
}
```

### 2.2 Buttons — unify with Dawn button physics

Custom "Add to cart" buttons use Tailwind color transitions only. Align with Dawn's `:after` border-grow hover (already in `base.css`) by adopting the `.button` class, or add a lightweight press state:

```css
.add-to-cart-btn {
  transition: background-color var(--duration-default) ease,
              color var(--duration-default) ease,
              transform var(--duration-short) ease;
}
.add-to-cart-btn:active:not([aria-disabled='true']) {
  transform: scale(0.98);
}
```

### 2.3 Navigation — underline slide

`header-main.liquid` nav links use `hover:underline`. A sliding underline feels more polished and avoids reflow:

```css
.header-main__navigation a {
  position: relative;
  text-decoration: none;
}
.header-main__navigation a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -0.2rem;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform var(--duration-default) ease;
}
.header-main__navigation a:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

### 2.4 Wishlist heart — micro-bounce

In `snippets/custom-product-card.liquid`, the heart icon has no active-state feedback:

```css
.wishlist-toggle.is-active .heart-icon {
  animation: heartPop var(--duration-medium) ease;
}
@keyframes heartPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
```

Toggle `.is-active` from `assets/wishlist.js` when the item is saved.

### 2.5 Fix invalid Tailwind classes

`tailwind.config.js` has an empty `extend` block. These classes in custom sections **do not generate CSS**:

| Used class | Issue | Fix |
|---|---|---|
| `duration-600` | Not in default Tailwind scale | Use `duration-500` or extend: `{ transitionDuration: { 600: '600ms' } }` |
| `scale-70`, `scale-90`, `scale-120` | Not default scale values | Use `scale-75`, `scale-90`, `scale-110` or extend scale |
| `z-5` | Not a default z-index | Use `z-10` or extend zIndex |
| `hover:scale-120` in benefits | Silent no-op | `hover:scale-105` |

---

## 3. Drawer, Modal & Accordion Animations

### 3.1 Mobile menu — align with Dawn drawer pattern

The custom mobile menu in `header-main.liquid` works but duplicates Dawn's `MenuDrawer` behavior. Current implementation is reasonable; polish the overlay:

```js
function openMenu() {
  wrapper.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.replace('opacity-0', 'opacity-70');
    overlay.classList.replace('pointer-events-none', 'pointer-events-auto');
    menu.classList.replace('-translate-x-[45vw]', 'translate-x-0');
  });
}
```

**Add `prefers-reduced-motion` guard:**

```js
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) {
  menu.classList.remove('-translate-x-[45vw]');
  overlay.classList.remove('opacity-0');
  return;
}
```

**Improvement:** Consider reusing Dawn's `header-drawer` snippet and `component-menu-drawer.css` for consistency and built-in submenu animations.

### 3.2 Cart drawer — fix unreliable animation trigger

`cart-drawer.js` uses a bare `setTimeout` because the animation "doesn't always get triggered":

```js
setTimeout(() => {
  this.classList.add('animate', 'active');
}, 0);
```

**Replace with `requestAnimationFrame` double-buffer (more reliable):**

```js
open(triggeredBy) {
  // ...existing setup...
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.classList.add('animate', 'active');
    });
  });
}
```

**Add overlay fade in `component-cart-drawer.css`:**

```css
cart-drawer {
  visibility: hidden;
  opacity: 0;
  transition: visibility var(--duration-default) ease,
              opacity var(--duration-default) ease;
}
cart-drawer.active {
  visibility: visible;
  opacity: 1;
}
```

### 3.3 Quick-add modal — animate overlay + use `inert`

`quick-add-to-cart.js` animates `.modal-content` but not the overlay.

**On open (`quick-add-to-cart.js`):**

```js
const overlay = document.getElementById('quick-add-to-cart__overlay');
modal.classList.remove('hidden');
modal.classList.add('flex');
requestAnimationFrame(() => {
  overlay?.classList.add('opacity-100');
  modalContent.classList.remove('translate-y-[100%]', 'opacity-0');
  modalContent.classList.add('translate-y-0', 'opacity-100');
});
document.body.classList.add('overflow-hidden');
```

**On close — wait for `transitionend` instead of hardcoded 300ms:**

```js
function closeModal(modal, modalContent) {
  const overlay = document.getElementById('quick-add-to-cart__overlay');
  overlay?.classList.remove('opacity-100');
  modalContent.classList.add('translate-y-[100%]', 'opacity-0');
  modalContent.addEventListener('transitionend', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  }, { once: true });
}
```

### 3.4 Accordions — smooth height transition (CSS grid trick)

Dawn's `component-accordion.css` rotates the caret but content opens instantly. For product FAQ / collapsible content sections, use a pure CSS approach (no JS height calculation):

```css
.accordion__content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-default) ease;
}
.accordion details[open] + .accordion__content,
.accordion details[open] > .accordion__content {
  grid-template-rows: 1fr;
}
.accordion__content > * {
  overflow: hidden;
}
```

For `<details>`-based accordions, pair with `details-disclosure.js` which already uses Web Animations API — ensure `prefers-reduced-motion` cancels animations (already handled).

**Cart drawer footer `<details>` (order note):** Add caret transition:

```css
.drawer__footer summary .icon-caret {
  transition: transform var(--duration-default) ease;
}
```

---

## 4. Image Loading & Perceived Performance

### 4.1 Fade-in on image load (lightweight, global)

Add a small vanilla JS module — no libraries:

**`assets/image-reveal.js` (new):**

```js
function revealImage(img) {
  img.classList.add('image-loaded');
}

document.querySelectorAll('img[loading="lazy"]:not([data-no-reveal])').forEach((img) => {
  if (img.complete) {
    revealImage(img);
  } else {
    img.addEventListener('load', () => revealImage(img), { once: true });
  }
});

document.addEventListener('shopify:section:load', (e) => {
  e.target.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    if (img.complete) revealImage(img);
    else img.addEventListener('load', () => revealImage(img), { once: true });
  });
});
```

**CSS (add to `assets/base.css` or a small `component-image-reveal.css`):**

```css
img[loading='lazy']:not(.image-loaded) {
  opacity: 0;
}
img[loading='lazy'].image-loaded {
  opacity: 1;
  transition: opacity var(--duration-medium) ease;
}
@media (prefers-reduced-motion: reduce) {
  img[loading='lazy'] { opacity: 1; transition: none; }
}
```

Load in `layout/theme.liquid` after `global.js`.

### 4.2 Fix dimension mismatches on custom product cards (CLS)

In `snippets/custom-product-card.liquid`:

```liquid
width="300"
height="150"   <!-- 2:1 ratio -->
class="... aspect-[2/1]"
```

Dimensions are consistent, but use Shopify's `image_url` + `image_tag` filter for `srcset`/`sizes`:

```liquid
{{
  card_product.featured_media
  | image_url: width: 600
  | image_tag:
    loading: lazy_load,
    widths: '300, 600',
    sizes: '(min-width: 750px) 25vw, 50vw',
    class: 'product-main-image w-full object-cover aspect-[2/1] ...',
    width: 300,
    height: 150
}}
```

### 4.3 Categories list — add lazy loading + fixed circle size

`sections/categories-list.liquid` line 21 uses deprecated `img_url` and omits `loading="lazy"`:

```liquid
<div class="image__container w-[164px] h-[164px] bg-gray-50 rounded-full ...">
  {{
    collection.image
    | image_url: width: 164, height: 164, crop: 'center'
    | image_tag:
      loading: 'lazy',
      width: 164,
      height: 164,
      alt: custom_title | default: collection.title,
      class: 'rounded-full w-full h-full object-cover'
  }}
</div>
```

Fixed `w-[164px] h-[164px]` on the container reserves space before the image loads.

### 4.4 Hero slider — reserve space for dynamic text

`hero-slider.js` fetches product title/price on slide change, causing text height jumps.

**Fix — min-height on text container:**

```css
.hero-slider__content .product__title,
.hero-slider__content .product__price {
  min-height: 1.5em;
}
```

**Better — crossfade text on update:**

```js
function updateSlideInfo(handle) {
  const container = document.querySelector('.hero-slider__content');
  container.classList.add('is-updating');
  // update text...
  requestAnimationFrame(() => container.classList.remove('is-updating'));
}
```

```css
.hero-slider__content.is-updating {
  opacity: 0.6;
  transition: opacity var(--duration-short) ease;
}
```

### 4.5 LCP image priority

Ensure the first hero/banner image uses `fetchpriority="high"` and `loading="eager"`. Dawn's `image-banner.liquid` and `slideshow.liquid` already support this — verify custom `hero-slider.liquid` first slide does the same.

---

## 5. CLS & Jank Issues — Diagnosis & Fixes

| Issue | File(s) | Severity | Fix |
|---|---|---|---|
| Header hidden until JS | `sections/header-main.liquid` | High | §1.3 — CSS-first visible state |
| Header `fixed` toggle on scroll | `header-main.liquid` | Medium | Reserve space with `min-height: 60px` on a wrapper; use `position: sticky` instead of toggling `fixed` |
| Facet filter grid swap | `assets/facets.js` | High | Min-height on `#ProductGridContainer`; skeleton opacity during `.loading` |
| Facet scroll-trigger re-init bug | `assets/facets.js` | Medium | Pass DOM element, not `html.innerHTML` string (§1.2) |
| Compare-at price always rendered | `snippets/custom-product-card.liquid` | Low | Wrap in `{% if compare_price > current_price %}` |
| Swiper layout before init | `popular_products.liquid`, etc. | Medium | Set `min-height` on slider; use `visibility: hidden` until Swiper `init` event |
| `setTimeout(300)` modal close | `quick-add-to-cart.js` | Low | Use `transitionend` (§3.3) |
| Cart drawer `setTimeout(0)` | `cart-drawer.js` | Low | Double `requestAnimationFrame` (§3.2) |
| Invalid Tailwind utilities | Multiple custom sections | Medium | §2.5 — fix or extend config |
| Zoom scroll listener per element | `assets/animations.js` | Low | Consider single shared scroll listener (throttled) for all zoom elements |
| Floating header shadow pop-in | `header-main.liquid` | Low | Transition `box-shadow` on the header pill when sticky |

### Facet loading skeleton (recommended)

```css
.collection.loading .product-grid {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity var(--duration-short) ease;
}
.collection.loading .product-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
```

### Sticky header without layout shift

Replace scroll JS toggle with CSS sticky:

```css
.header-main-wrapper {
  position: sticky;
  top: 0;
  z-index: 20;
}
```

Remove the `fixed`/`top-0` class toggling in `header-main.liquid` when `header_float_checkbox` is enabled.

---

## 6. Swiper vs Dawn `slider-component` (resolved)

~~Swiper is loaded on `index`, `collection`, and `product` templates (~140KB combined with CSS).~~ **Done:** Swiper has been fully removed from the theme (vendored bundle deleted, loader removed from `theme.liquid`). All 5 carousels now run on two new dependency-free custom elements — `hero-slider-component` (bespoke, for the centered-scale hero effect) and `row-slider-component` (shared, for the 4 simple row/banner carousels). Full design writeup and rationale: [.docs/slider.md](slider.md).

---

## 7. Implementation Roadmap

### Phase 1 — Quick wins (1–2 days, low risk)

- [x] Fix invalid Tailwind classes (`duration-600`, `scale-120`, `z-5`)
- [x] Add `scroll-trigger` classes to custom sections (behind existing theme setting)
- [x] Fix `facets.js` scroll-trigger re-initialization bug
- [x] Add `loading="lazy"` + fixed dimensions to `categories-list` images
- [x] Fix compare-at price conditional in `custom-product-card.liquid`
- [x] Header visible-by-default CSS (§1.3)

### Phase 2 — Polish (2–3 days)

- [x] `image-reveal.js` + CSS for lazy image fade-in
- [x] Product card hover scale + lift
- [x] Cart drawer `requestAnimationFrame` + overlay fade
- [x] Quick-add modal overlay animation + `transitionend` close
- [x] Nav underline slide animation
- [x] Facet loading skeleton styles

### Phase 3 — Architecture (3–5 days)

- [x] Replace Swiper everywhere (`hero-slider`, `popular_products`, `recent-viewed`, `best-deal-banner`, `cart-drawer`) with dependency-free custom elements — see [.docs/slider.md](slider.md)
- [ ] Consolidate mobile menu onto Dawn `header-drawer` pattern
- [ ] Accordion height animation for collapsible content
- [ ] Shared reduced-motion helper utility in JS
- [ ] Sticky header refactor (remove scroll listener layout shift)

---

## 8. Testing Checklist

- [ ] Enable **Theme settings → Animations → Reveal sections on scroll** and verify custom sections animate
- [ ] Enable **3D lift** hover setting; confirm it does not conflict with custom card hovers
- [ ] Test with `prefers-reduced-motion: reduce` in DevTools — no scroll/hover animations should run
- [ ] Run Lighthouse → Performance → inspect **CLS** on homepage, collection, and product pages
- [ ] Test facet filtering: grid should not jump; scroll animations should re-trigger on new items
- [ ] Test cart drawer, mobile menu, and quick-add modal open/close on mobile Safari (iOS momentum scroll)
- [ ] Verify keyboard focus trap still works after modal/drawer animation changes
- [ ] Test `hero-slider-component` / `row-slider-component` carousels before JS loads (layout should not collapse) — Swiper has been removed, see [.docs/slider.md](slider.md)

---

## 9. Reference: Dawn Animation Tokens

Use these existing variables for consistency:

```css
--duration-short: 100ms;
--duration-default: 200ms;
--duration-medium: 300ms;
--duration-long: 500ms;
--duration-extra-long: 600ms;
--ease-out-slow: cubic-bezier(0, 0, 0.3, 1);
```

**Theme settings** (`config/settings_schema.json`):

- `animations_reveal_on_scroll` — toggles `animations.js` and `scroll-trigger` classes
- `animations_hover_elements` — `none` | `vertical-lift` | `3d-lift` (applied to `body`)

Ensure new custom CSS always wraps motion in:

```css
@media (prefers-reduced-motion: no-preference) { /* animated styles */ }
```

---

## 10. Files to Touch (summary)

| File | Action |
|---|---|
| `sections/popular_products.liquid` | Add `scroll-trigger`; consider Dawn slider |
| `sections/categories-list.liquid` | Scroll reveal, lazy images, fix Tailwind |
| `sections/benefits.liquid` | Scroll reveal, fix scale classes |
| `sections/header-main.liquid` | CLS fix, nav underline, sticky refactor |
| `snippets/custom-product-card.liquid` | Image hover, `image_tag`, price conditional |
| `assets/facets.js` | Fix scroll-trigger re-init |
| `assets/cart-drawer.js` | Reliable open animation |
| `assets/quick-add-to-cart.js` | Overlay + transitionend close |
| `assets/image-reveal.js` | **New** — lazy image fade-in |
| `assets/base.css` or new CSS partial | Image reveal, accordion, skeleton styles |
| `layout/theme.liquid` | Load `image-reveal.js` |
| `tailwind.config.js` | Extend duration/scale tokens if keeping custom values |

---

*This document is intended as a living implementation guide. Start with Phase 1 items for the best UX-to-effort ratio while staying aligned with Dawn's lightweight, HTML-first architecture.*

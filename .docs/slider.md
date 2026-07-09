# Slider / Carousel Audit — Swiper Usage & Migration Options

Status: **implemented.** Sections 1–7 below are the original research/plan (kept as-is for context — historical file/line references to Swiper describe the pre-migration state). Section 8 documents what was actually shipped and where it diverges from the plan.

## 1. How Swiper is currently loaded

- **Not an npm dependency** — no `swiper` entry in `package.json`, nothing in `node_modules`, no import in `src/` or `vite.config.ts`.
- **Vendored, full UMD bundle** committed directly into `assets/`:
  - [assets/swiper-bundle.min.js](assets/swiper-bundle.min.js) — Swiper **11.2.7**, ~154 KB
  - [assets/swiper-bundle.min.css](assets/swiper-bundle.min.css) — ~18 KB
  - This is the *entire* library (every module), not a tree-shaken/modular build.
- **Conditionally injected** in [layout/theme.liquid:296-301](layout/theme.liquid#L296-L301):
  ```liquid
  {% comment %} Load swiper in specific page  {% endcomment %}
  {% assign valid_templates = 'index,collection,product' | split: ',' %}
  {% if valid_templates contains template.name %}
    {{ 'swiper-bundle.min.css' | asset_url | stylesheet_tag }}
    <script src="{{ "swiper-bundle.min.js" |  asset_url }}" defer></script>
  {% endif %}
  ```
  Loaded only on `index`, `collection`, `product` — not site-wide — but CSS is render-blocking there (no `media` swap trick like `component-predictive-search.css` gets elsewhere in the same file), and JS is `defer`.
- Total cost on those 3 templates: **~172 KB raw** (JS + CSS) for a feature set that, per the config audit below, uses maybe 10% of what the library offers.

## 2. Every Swiper instance in the codebase

6 init call sites across 5 components — nothing more, nothing hidden elsewhere.

| # | File | Purpose | Config used |
|---|---|---|---|
| 1 | [assets/hero-slider.js:136](assets/hero-slider.js#L136) (section: [sections/hero-slider.liquid](sections/hero-slider.liquid)) | Homepage hero product carousel — centered slide is visually larger/opaque, side slides scaled down | `slidesPerView: 3`, `centeredSlides: true`, `loop: true`, `navigation`, `breakpoints: {0:{1}, 768:{3}}`, `speed: 600`, `on: {init, slideChange}` (drives async product data fetch/cache per active slide) |
| 2 | [sections/popular_products.liquid:49](sections/popular_products.liquid#L49) | "Popular products" row carousel | `slidesPerView` (data-attr, default 4), `spaceBetween: 24`, `navigation`, `breakpoints`, `loop: true` |
| 3 | [sections/recent-viewed.liquid:130](sections/recent-viewed.liquid#L130) | "Recently viewed" row carousel, content injected async via fetch | same shape as #2 |
| 4 | [sections/best-deal-banner.liquid:71](sections/best-deal-banner.liquid#L71) | Banner image gallery, autoplay | `slidesPerView: 1`, `autoplay: {delay: 3000}`, `loop: true` — **no navigation configured even though CSS styles `.swiper-button-*` for it** (dead CSS) |
| 5 | [snippets/cart-drawer.liquid:612](snippets/cart-drawer.liquid#L612) | Cart drawer cross-sell slider, empty-cart state (horizontal) | `slidesPerView: 1`, `spaceBetween: 24`, `autoplay`, `navigation`, `loop: true` |
| 6 | [snippets/cart-drawer.liquid:648](snippets/cart-drawer.liquid#L648) | Cart drawer cross-sell slider, has-cart state (vertical) | `direction: 'vertical'`, `slidesPerView: 3`, `loop: true`, `spaceBetween: 24`, `autoplay` |

`#5`/`#6` target the same CSS class (`.cart-drawer__slider`) but are mutually exclusive via Liquid `{% if cart == empty %}`, so only one ever runs.

**Modules actually used across all 6 instances: Navigation, Autoplay, loop, breakpoints, one `direction: vertical`.** That's it. Zero usage anywhere of Pagination, EffectFade/Coverflow/Cube, Thumbs, FreeMode, Grid, Virtual Slides, A11y module, RTL, Zoom, lazy-loading module, or slide-syncing between two sliders. `custom-product-card.liquid:16` just tags itself `swiper-slide` since it's reused as a slide inside #2/#3/#5.

⚠️ [.docs/BE.md:515-526](.docs/BE.md#L515-L526) documents a previously-fixed **double-init bug** on the recent-viewed slider (Swiper initialized once on an empty container, then again after cards loaded async → two live instances). Worth re-verifying this is still fixed if the component gets touched during any migration.

## 3. How tightly styling is coupled to Swiper's DOM

Moderate coupling, concentrated in nav-button styling, with one real exception:

- [assets/hero-slider.css](assets/hero-slider.css) — **the one genuine dependency**. Repositions/rescales based on `.swiper-slide-active` vs `.swiper-slide-prev`/`.swiper-slide-next` — that's literally the visual effect (centered, larger active slide, dimmed/scaled neighbors). Any replacement needs to reproduce this logic itself; Swiper isn't just providing scroll mechanics here, it's providing the state classes the effect is built on.
- [sections/recent-viewed.liquid:24-69](sections/recent-viewed.liquid#L24-L69), [sections/popular_products.liquid:69-108](sections/popular_products.liquid#L69-L108), [sections/best-deal-banner.liquid:82-104](sections/best-deal-banner.liquid#L82-L104) — three **near-duplicate** inline `<style>` blocks, all just repositioning/resizing `.swiper-button-prev`/`.swiper-button-next`. This is copy-paste, not a structural dependency — any carousel with prev/next buttons needs equivalent CSS, Swiper or not.
- [snippets/cart-drawer.liquid:628-643](snippets/cart-drawer.liquid#L628-L643) — sizing overrides for the vertical variant.

**Read:** 4 of 5 components (`popular_products`, `recent-viewed`, `best-deal-banner`, `cart-drawer`) are plain "N-per-view row + prev/next arrows [+ optional autoplay]" — nothing Swiper-specific about their design. Only `hero-slider` leans on Swiper's slide-state classes for its look.

## 4. Prior art already in this codebase: Dawn's native `slider-component`

This theme is Dawn-based, and Dawn's **dependency-free, scroll-snap-based carousel already ships and is already used in 8+ places**:

- [assets/global.js:728-827](assets/global.js#L728-L827) — `class SliderComponent extends HTMLElement`, a custom element (`<slider-component>`) built on native `scroll-snap-type: x mandatory` + `scrollTo()`, with `ResizeObserver`-driven pagination math, native `scroll` events, and ARIA-friendly disabled-state prev/next buttons.
- [assets/global.js:829+](assets/global.js#L829) — `class SlideshowComponent extends SliderComponent` adds looping, autoplay, and announcement-bar sync on top.
- Styling: [assets/component-slider.css](assets/component-slider.css) (377 lines).
- Already powering: `sections/collection-list.liquid`, `sections/featured-blog.liquid`, `sections/featured-collection.liquid`, `sections/multicolumn.liquid`, `snippets/product-media-gallery.liquid` (product image gallery, incl. a thumbnail variant), `sections/slideshow.liquid`, `sections/announcement-bar.liquid`, product template slideshow usage.

This means "build my own" isn't actually starting from zero — the scroll-snap engine, resize handling, and accessible button pattern are already written, tested, and running in production elsewhere in this exact theme. Extending it (rather than writing a new custom slider from scratch) is the lowest-risk path if going custom.

This exact recommendation is already flagged in the previous FE audit — [.docs/FE.md:605-615](.docs/FE.md#L605-L615) and the open action item at [.docs/FE.md:641](.docs/FE.md#L641): *"Evaluate replacing Swiper with `slider-component` in `popular_products` / `recent-viewed`."* This doc reaches the same conclusion independently and extends it to `best-deal-banner` and `cart-drawer`.

## 5. Options

### Option A — Keep Swiper, everywhere
- **Pros:** zero migration risk, autoplay/loop/vertical-direction all work today, single library to reason about.
- **Cons:** ~172 KB dead weight for a feature set this shallow; 3 duplicated nav-button CSS blocks; external dependency vendored (not npm-managed, so version bumps are manual copy-paste of a new minified file, no changelog diffing).

### Option B — Replace the 4 "simple row carousel" instances with Dawn's native `slider-component`; keep Swiper only for `hero-slider`
- Removes Swiper from `popular_products`, `recent-viewed`, `best-deal-banner`, `cart-drawer`.
- `hero-slider` keeps Swiper because its centered-scale effect is meaningfully built on Swiper's slide-position classes and touch physics — reproducing it isn't zero-effort.
- Still loads Swiper on `index`/`collection`/`product`... but **`hero-slider` only appears on `index`**, so this actually opens the door to loading Swiper *only* on the templates that render `hero-slider`, rather than all 3 — a further trim on `collection`/`product` pages once they no longer use it.
- Net effect: cuts ~172 KB off `collection` and `product` templates entirely, and unifies the 4 row-carousels onto the same accessible, already-audited component used elsewhere in the theme (fixes the 3x duplicated nav CSS as a side effect of consolidating).
- Cost: `slider-component`'s current form uses native scroll physics, not Swiper's `loop: true` infinite loop or `autoplay`. `SlideshowComponent` already adds looping + autoplay, so `best-deal-banner` and `cart-drawer` (both autoplay+loop) map onto it fairly directly; `popular_products`/`recent-viewed` (loop but no autoplay) map onto the simpler `SliderComponent`, though their `loop: true` behavior (infinite wraparound) isn't something `SliderComponent` does today — closest native equivalent is disabled-state prev/next buttons at the ends, not true infinite loop. That's a real behavior difference to flag, not just a styling one.

### Option C — Replace everything, including `hero-slider`, with a custom/extended `slider-component`
- Removes the Swiper dependency entirely (~172 KB gone from every template).
- Requires porting `hero-slider`'s centered-scale visual effect onto scroll-snap + IntersectionObserver (to know which slide is "centered") — doable, Dawn itself doesn't have prior art for this specific effect, so it's genuinely new code, not a copy of an existing pattern.
- Highest effort, highest payoff: one carousel implementation for the whole theme, no vendored third-party bundle to maintain/update.

### Option D — Swap Swiper for a smaller third-party library (e.g. Embla, Splide, Flickity)
- Given the config audit above (nav + autoplay + loop + breakpoints, nothing more), a lighter library would work functionally, but this still leaves a third-party dependency in the theme and doesn't reuse the `slider-component` code that's already proven out here. Weakest option relative to B/C given what's already in the codebase — flagged for completeness, not recommended over B or C.

## 6. Recommendation (for discussion, not yet actioned)

Option B first (mechanical, low-risk, matches the already-open FE.md action item), with Option C as a later follow-up once there's appetite to also rebuild `hero-slider`'s effect natively. This is a sequencing suggestion, not a decision — nothing has been changed.

**Decision: Option C.** Owner wants full control over `hero-slider`'s animation/behavior rather than inheriting whatever Swiper does internally. Section 7 below is the implementation plan for it. **Still research/planning only — no code has been changed.**

---

## 7. Implementation Plan — Option C

### 7.1 Scope

Remove Swiper entirely from the theme (delete the vendored bundle, the `theme.liquid` loader, and every `swiper*` class reference) and replace all 5 components with dependency-free custom elements:

| Component | Replacement approach |
|---|---|
| `hero-slider` | **New bespoke custom element** (`HeroSliderComponent`) — see 7.2, this is the detailed design the owner asked for |
| `popular_products`, `recent-viewed` | Extend Dawn's existing `SliderComponent` (scroll-snap, no autoplay/loop needed) |
| `best-deal-banner`, `cart-drawer` | Extend Dawn's existing `SlideshowComponent` (adds autoplay + true loop on top of `SliderComponent`) |

`hero-slider` gets a bespoke component rather than reusing `SliderComponent` because its effect (three visibly different slide sizes, a growing/shrinking center) isn't a scroll-snap row — it's a "3-slot stage" carousel, structurally different from the other four. Building the other four on the existing `SliderComponent`/`SlideshowComponent` classes keeps this plan consistent with the already-open action item in [.docs/FE.md:641](.docs/FE.md#L641) and avoids inventing two new carousel engines when one already exists for the simple case. Section 7.2 is the deep dive on `hero-slider`; section 7.5 covers the other four at a lighter level since they're the mechanical part.

### 7.2 `hero-slider` — target behavior (from requirements)

- **Desktop:** 3 products visible at once — previous (small, dimmed), active (large, centered, full opacity), next (small, dimmed).
- **Mobile:** 1 product visible (active only, full width).
- **On next/prev click:** the current center product animates smaller and moves out of center; the incoming product animates from its side position into the center and grows. Both happen together as one continuous transition, not a cut.
- **Loop:** wraps around at the ends (matches current `loop: true` behavior).
- Animation timing/scale must be **configurable**, not hardcoded — this is the "fully control the slider setting" requirement.

### 7.3 Chosen technique: distance-based absolute positioning (no scroll track, no clones)

Rather than porting Swiper's approach (a real horizontal scroll track + `loop: true` slide-cloning at the edges), the plan uses a simpler technique that gets the same visual result with less machinery:

- All real slides stay mounted in the DOM at once (up to 10 products from `hero-slider-products`, no cloning, no scroll container).
- Each slide computes its own **circular distance** from `activeIndex`: `distance = i - activeIndex`, wrapped into the range `(-total/2, total/2]` so it always takes the shorter direction around the loop.
- That `distance` maps to a **role** and a corresponding inline transform, applied per-slide:

  | `distance` | Role | Desktop transform | Mobile transform |
  |---|---|---|---|
  | `0` | active | `translateX(0) scale(var(--active-scale))`, `opacity: var(--active-opacity)`, top `z-index` | `translateX(0) scale(1)`, `opacity: 1` |
  | `-1` | prev | `translateX(-1 * var(--side-offset)) scale(var(--side-scale))`, `opacity: var(--side-opacity)` | `translateX(-100%)`, `opacity: 0`, `pointer-events: none` |
  | `+1` | next | `translateX(var(--side-offset)) scale(var(--side-scale))`, `opacity: var(--side-opacity)` | `translateX(100%)`, `opacity: 0`, `pointer-events: none` |
  | `\|distance\| >= 2` | far | fully off-canvas (`translateX(±(side-offset + slide-width))`), `opacity: 0`, `pointer-events: none` | same as ±1, invisible |

- Every slide has `transition: transform var(--hero-slider-duration) var(--hero-slider-easing), opacity var(--hero-slider-duration) var(--hero-slider-easing)` set once, so **changing `activeIndex` and re-applying the transform/opacity/scale on all slides is the entire animation** — the browser tweens it. No manual keyframe orchestration needed.
- Loop is **free**: because positioning is pure modulo arithmetic on the real slide index, there's no "reach the end, jump back invisibly" hack and no cloned DOM nodes to keep in sync with `hero-slider.js`'s product-data cache (which keys off `data-handle` on real elements).
- This directly produces the requested animation: clicking "next" moves `activeIndex` forward by 1 → the old active slide (`distance` was `0`, now `-1`) shrinks and slides toward the side → the old "next" slide (`distance` was `+1`, now `0`) grows and slides into center — exactly "smaller the center, move next into center and bigger it."

This is a deliberate departure from Swiper's internal implementation (real scroll track + edge clones), not a port of it — it's simpler to reason about, has no clone/reset edge cases, and every visual parameter is a CSS custom property instead of buried in a JS options object.

### 7.4 Config surface (the "animation config" ask)

Exposed two ways: **theme-editor schema settings** (merchant-facing, no code edits) that render as **CSS custom properties + data attributes** on the `<hero-slider-component>` element (consumed by CSS/JS). Proposed settings to add to `sections/hero-slider.liquid`'s `{% schema %}`:

| Setting id | Type | Default | Drives |
|---|---|---|---|
| `transition_duration` | `range` (200–1000ms, step 50) | `600` | `--hero-slider-duration`. Also fixes an existing inconsistency: today JS `speed: 600` and CSS `transition: all 0.3s` disagree — this becomes the single source of truth. |
| `transition_easing` | `select` (`ease`, `ease-in-out`, `ease-out`, `linear`) | `ease-in-out` | `--hero-slider-easing` |
| `active_scale` | `range` (0.8–1.3, step 0.05) | `1` | `--hero-slider-active-scale` |
| `side_scale` | `range` (0.3–1, step 0.05) | `0.6` | `--hero-slider-side-scale` |
| `side_opacity` | `range` (0–1, step 0.05) | `0.5` | `--hero-slider-side-opacity` |
| `active_width` | `range` (30–70%, step 5) | `50` | `--hero-slider-active-width`; side width derives as `(100% - active_width) / 2` |
| `enable_loop` | `checkbox` | `true` | `data-loop` (JS wraparound behavior) |
| `enable_swipe` | `checkbox` | `true` | `data-swipe` (JS touch/drag, see 7.6) |

Autoplay is **not** in this list — the current `hero-slider` has no autoplay today and the requirements described are click-driven only, so adding it isn't in scope unless requested separately. Flagging it here only so it's a deliberate omission, not an oversight.

### 7.5 Markup / component structure

`sections/hero-slider.liquid` changes from Swiper's structure to:

```html
<hero-slider-component
  class="hero-slider__slider"
  style="--hero-slider-duration: {{ section.settings.transition_duration }}ms; --hero-slider-easing: {{ section.settings.transition_easing }}; --hero-slider-active-scale: {{ section.settings.active_scale }}; --hero-slider-side-scale: {{ section.settings.side_scale }}; --hero-slider-side-opacity: {{ section.settings.side_opacity }}; --hero-slider-active-width: {{ section.settings.active_width }}%;"
  data-loop="{{ section.settings.enable_loop }}"
  data-swipe="{{ section.settings.enable_swipe }}"
>
  <button type="button" class="hero-slider__prev" aria-label="Previous product">…</button>
  <div class="hero-slider__stage" aria-live="polite">
    {% for product in section.settings['hero-slider-products'] limit: 10 %}
      <div class="hero-slider__slide" data-index="{{ forloop.index0 }}" data-handle="{{ product.handle }}" aria-hidden="true">
        <img class="product-main-image" src="{{ product.featured_media | image_url: width: 500 }}" ...>
      </div>
    {% endfor %}
  </div>
  <button type="button" class="hero-slider__next" aria-label="Next product">…</button>
</hero-slider-component>
```

- `swiper-button-prev`/`-next` `<div>`s become real `<button type="button">` elements — free accessibility/keyboard win, no functional downside.
- `.hero-slider__stage` replaces `.swiper-wrapper`; slides keep their `data-handle` so `hero-slider.js`'s existing product-fetch/cache logic (localStorage cache, `prefetchProducts`, `refreshProductsIfChanged`) needs **no changes to its data layer** — only its Swiper integration points change (see 7.6).

### 7.6 JS: `HeroSliderComponent` (replaces the `new Swiper(...)` call in `assets/hero-slider.js`)

A `class HeroSliderComponent extends HTMLElement` registered as `customElements.define('hero-slider-component', HeroSliderComponent)`, responsible only for carousel mechanics:

- **State:** `activeIndex`, `slides` (NodeList), `isAnimating` (guards against spamming next/prev mid-transition — ignore clicks while `isAnimating` is true, matches Swiper's default behavior of queuing/ignoring rapid clicks).
- **`connectedCallback`:** read config from `data-*` attributes, call `render()` once on init, wire up prev/next button click handlers, `ResizeObserver` (desktop/mobile breakpoint switch, matches existing `768px` breakpoint), optional swipe handlers (see below), and `matchMedia('(prefers-reduced-motion: reduce)')` — when true, skip the CSS transition (apply the end state instantly) instead of disabling the feature outright, consistent with the existing reduced-motion pattern already used elsewhere in the theme (e.g. [assets/base.css:572](assets/base.css#L572), [assets/animations.js](assets/animations.js)).
- **`render()`:** loop over `slides`, compute circular `distance` per slide, apply role class (`is-active` / `is-prev` / `is-next` / `is-far`) and let CSS custom properties (set once per role via class, not recalculated per slide in JS) handle the actual transform — keeps the transform math in CSS, JS only decides *which* class each slide gets.
- **`goTo(index)` / `next()` / `prev()`:** update `activeIndex` (modulo `slides.length`, or clamped at the ends if `data-loop="false"`), call `render()`, then dispatch `slideChange` (`CustomEvent`, `detail: { index, handle }`) once the transition ends (listen for `transitionend` on the active slide, matching Swiper's `slideChange` timing today).
- **Swipe (optional, `data-swipe="true"` by default):** basic `pointerdown`/`pointermove`/`pointerup` delta-threshold handler on the stage calling `next()`/`prev()` — this replaces Swiper's built-in touch physics. Flagging as the one place where feature parity takes real new code (Swiper's drag handling is nontrivial); a simple threshold-swipe (no momentum/rubber-banding) is proposed as "good enough" rather than trying to fully replicate Swiper's touch feel. Open question for review: is basic swipe (no momentum) an acceptable trade, or does the current drag feel need to be preserved exactly?
- **`assets/hero-slider.js` changes:** keep `productCache`/`localStorage`/`prefetchProducts`/`updateSlideInfo`/`refreshProductsIfChanged` as-is; replace the `new Swiper(sliderEl, {...})` block with `document.querySelector('.hero-slider__slider').addEventListener('slideChange', (e) => updateSlideInfo(e.detail.handle))`, and swap the `swiper.slides[swiper.activeIndex]` reference in `refreshProductsIfChanged` for the component's own `activeIndex`/`slides` state (exposed as public properties on the element, e.g. `heroSliderEl.activeIndex`).

### 7.7 CSS (`assets/hero-slider.css` rewrite)

Replace all `.swiper-slide*`/`.swiper-button-*` selectors with the new class names, driven by the custom properties from 7.4:

```css
.hero-slider__stage { position: relative; }
.hero-slider__slide {
  position: absolute;
  inset: 0;
  margin: auto;
  transition: transform var(--hero-slider-duration, 600ms) var(--hero-slider-easing, ease-in-out),
              opacity var(--hero-slider-duration, 600ms) var(--hero-slider-easing, ease-in-out);
}
.hero-slider__slide.is-active { transform: scale(var(--hero-slider-active-scale, 1)); opacity: 1; z-index: 10; }
.hero-slider__slide.is-prev   { transform: translateX(calc(-1 * var(--hero-slider-side-offset))) scale(var(--hero-slider-side-scale, 0.6)); opacity: var(--hero-slider-side-opacity, 0.5); }
.hero-slider__slide.is-next   { transform: translateX(var(--hero-slider-side-offset)) scale(var(--hero-slider-side-scale, 0.6)); opacity: var(--hero-slider-side-opacity, 0.5); }
.hero-slider__slide.is-far    { opacity: 0; pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  .hero-slider__slide { transition: none; }
}

@media (max-width: 768px) {
  .hero-slider__slide.is-prev,
  .hero-slider__slide.is-next { transform: translateX(var(--hero-slider-mobile-offset, 100%)); opacity: 0; }
}
```

(Illustrative, not final — exact values TBD during implementation.) This also **fixes the 3x duplicated nav-button CSS smell** noted in section 5, since `hero-slider` no longer shares Swiper's global `.swiper-button-*` classnames with the other sections at all.

### 7.8 Accessibility additions (not present today, low-cost to add while rebuilding)

- Real `<button>` elements for prev/next (see 7.5).
- `aria-live="polite"` on `.hero-slider__stage` so screen readers announce the product title change (pairs with the existing `.product__title` text update in `hero-slider.js`).
- `aria-hidden="true"` on non-active slides, removed on the active one, so assistive tech doesn't read duplicate/side product info.
- Arrow-key support (`ArrowLeft`/`ArrowRight`) when the component has focus.
- `prefers-reduced-motion: reduce` → instant state change, no animated transition (see 7.6/7.7).

### 7.9 The other 4 components (mechanical migration, Option C scope)

Lighter-touch since they're straightforward row carousels already matching `SliderComponent`/`SlideshowComponent`'s existing capabilities:

- `popular_products.liquid`, `recent-viewed.liquid`: swap `swiper`/`swiper-wrapper`/`swiper-slide` markup for `<slider-component>` + `id="Slider-…"`/`id="Slide-…"` structure (per Dawn's existing convention used in `featured-collection.liquid` etc.), drop the per-section duplicated nav-button CSS in favor of one shared stylesheet rule.
- `best-deal-banner.liquid`, `cart-drawer.liquid` (both instances): same, but using `<slideshow-component>` to retain autoplay + true loop.
- `custom-product-card.liquid:16`'s `swiper-slide` class gets renamed to whatever the target component expects (or dropped if not needed — `SliderComponent` doesn't require a class on the slide itself, only `id="Slide-…"`).
- Known regression risk carried over from the earlier audit: the recent-viewed double-init bug documented in [.docs/BE.md:515-526](.docs/BE.md#L515-L526) was a Swiper-specific symptom (initializing before async content loaded); worth deliberately re-testing the async-load timing against `SliderComponent`'s `ResizeObserver`-driven `initPages()` to confirm it doesn't have an equivalent failure mode, not just assuming it's fixed by the migration.

### 7.10 Cleanup (final step, after all 5 are migrated and verified)

- Delete `assets/swiper-bundle.min.js`, `assets/swiper-bundle.min.css`.
- Remove the Swiper `<script>`/`<link>` block from [layout/theme.liquid:296-301](layout/theme.liquid#L296-L301) entirely.
- Update [.docs/FE.md:605-615](.docs/FE.md#L605-L615) and the action items at lines 641/658 to reflect completion instead of "evaluate."
- Grep the repo for `swiper` to confirm zero remaining references before calling it done.

### 7.11 Suggested sequencing / rollback safety

1. Build `hero-slider`'s new component behind the existing markup (new files, don't touch `theme.liquid` yet) → test in isolation on a theme preview.
2. Migrate `hero-slider.liquid` to the new markup; keep Swiper still loading (harmless, unused) until the other 4 are also migrated, so each step is independently revertable via git without re-touching `theme.liquid`.
3. Migrate the 4 simple carousels one at a time (7.9).
4. Only after all 5 are confirmed working: do the cleanup pass (7.10).
5. At each step, visually diff against current production behavior (breakpoints, loop wraparound at both ends, rapid click-spam on next/prev, single-product edge case, empty-cart vs has-cart drawer states).

### 7.12 Open questions before implementation starts

- **Swipe/drag fidelity** (7.6): is a basic threshold-swipe acceptable, or must touch feel match Swiper's physics exactly?
- **Default values** for the new range settings (7.4) — the ones listed match current hardcoded Swiper/CSS values so visual output is unchanged by default; confirm that's desired, versus intentionally changing the look while rebuilding.
- **`active_width`/`side_scale` merchant exposure** — should all of these be theme-editor settings (merchant-tunable per store), or should some stay as fixed constants in CSS/JS and only expose duration/easing/loop to merchants? More settings = more theme-editor surface to maintain.

Nothing above has been implemented — this is the plan for review. Next step on approval: start with 7.11 step 1 (build the new `hero-slider` component in isolation) before touching any shared files like `theme.liquid`.

---

## 8. What was actually implemented

Swiper has been fully removed. Two new custom elements replace it; every section/snippet that used Swiper now uses one of them.

### 8.1 `hero-slider-component` — built as planned (section 7.3–7.8)

- [assets/hero-slider.js](assets/hero-slider.js) — `HeroSliderComponent` class (circular-distance role assignment, `goTo`/`next`/`prev`, `transitionend`-driven `slideChange` event, pointer-based swipe, `prefers-reduced-motion` handling) + the original product-cache/fetch logic from the old file, now listening to `slideChange` instead of Swiper's `on: slideChange`.
- [assets/hero-slider.css](assets/hero-slider.css) — role classes (`is-active`/`is-adjacent`) driven by a single `--d` custom property per slide (set in JS) and merchant-tunable custom properties (`--hero-slider-duration`, `--hero-slider-easing`, `--hero-slider-active-scale`, `--hero-slider-side-scale`, `--hero-slider-side-opacity`, `--hero-slider-active-width`). Mobile behavior (1 slide, no side peek) is a pure CSS override of the same `--d`-based transform, not separate JS logic.
- [sections/hero-slider.liquid](sections/hero-slider.liquid) — new markup (`<hero-slider-component>`, real `<button>`s with `icon-caret.svg`), plus the animation schema settings from 7.4 (`transition_duration`, `transition_easing`, `active_width`, `active_scale`, `side_scale`, `side_opacity`, `enable_loop`, `enable_swipe`).
- One deviation from 7.3's original write-up: rather than JS computing pixel offsets, the shipped version leans entirely on CSS's own percentage semantics (`width` resolves against the stage, `transform: translateX(%)` resolves against the slide's own box) so **no `ResizeObserver` or breakpoint JS branching is needed at all** — mobile vs. desktop is a plain CSS media query overriding the same custom properties. Simpler than what 7.3 sketched, same result.

### 8.2 `row-slider-component` — new shared element, not a literal reuse of Dawn's `SliderComponent`/`SlideshowComponent`

Section 7.9 originally proposed extending Dawn's existing `SliderComponent`/`SlideshowComponent` directly. During implementation that turned out to be a worse fit than planned: those two classes are tightly coupled to Dawn's own markup contract (`id="Slider-…"`/`id="Slide-…"`, `grid--N-col-desktop` classes, dot/number slide-counters, announcement-bar hooks) which doesn't match this theme's card-grid markup (`data-desktop`/`data-mobile` attributes, `custom-product-card` snippet, Tailwind utility classes). Forcing a fit would have meant rewriting the product-card markup/CSS, not just swapping the carousel engine.

Instead, one small purpose-built element was written and reused across all 4 simple carousels:

- [assets/component-row-slider.js](assets/component-row-slider.js) — `RowSliderComponent`. Uses **native scroll + `scroll-snap`** (not a JS-driven transform track), so touch/trackpad dragging works for free with zero custom pointer-event code — a simplification versus the hero-slider's bespoke transform approach, justified because these 4 carousels don't need hero's variable-size-per-role effect. Loop is implemented via the classic edge-clone technique (clone `max(slidesDesktop, slidesMobile)` items on each side, silently `scrollLeft`/`scrollTop`-jump back into the real range once scrolled solidly into clone territory, detected via a debounced `scroll` listener). Supports `data-direction="horizontal"|"vertical"`, `data-loop`, `data-autoplay`/`data-autoplay-delay` (pauses on hover/focus and under `prefers-reduced-motion`), and exposes a public `refresh()` method for async-populated sliders.
- [assets/component-row-slider.css](assets/component-row-slider.css) — shared styles, including the previously-duplicated nav-button CSS (was copy-pasted 3x across `popular_products`/`recent-viewed`/`best-deal-banner`, per section 5) now centralized once. Slide width is `slidesPerView`-driven via `--row-slider-slides-desktop`/`--row-slider-slides-mobile` custom properties set inline from each section's schema settings, same pattern as hero-slider's config surface.
- Both `hero-slider.js` and `component-row-slider.js` guard their `customElements.define()` calls with `if (!customElements.get(...))`, since these sections are self-contained (each loads its own script tag) and could theoretically render more than once on a page (e.g. `cart-drawer` on every page plus a section using the same component) — the guard makes repeated `<script>` inclusion safe instead of throwing on re-registration.
- **CSS scoping fix caught during implementation:** `custom-product-card.liquid`'s root class was renamed from `swiper-slide` to `row-slider__item` (it's reused as the slide/card markup inside `popular_products`, `recent-viewed`, and `cart-drawer`). That card snippet is *also* rendered standalone (no slider wrapper) in `sections/wishlist.liquid` and `sections/custom-collection-products-grid.liquid`. The shared CSS rule that turns `.row-slider__item` into a flex/scroll-snap slide is scoped as `.row-slider__track > .row-slider__item` specifically so it has no effect on those two non-slider usages.

### 8.3 Per-component changes

| File | Change |
|---|---|
| [sections/popular_products.liquid](sections/popular_products.liquid) | Swiper → `row-slider-component`, `slidesPerView` from `products-per-slide-desktop` setting (unchanged setting id) |
| [sections/recent-viewed.liquid](sections/recent-viewed.liquid) | Swiper → `row-slider-component`; async-injected cards now call the component's `refresh()` method instead of constructing a second slider instance — the double-init class of bug noted in [.docs/BE.md:515-526](BE.md#L515-L526) is structurally prevented here, not just retested, because `connectedCallback` no-ops on an empty container and `refresh()` is the only code path that ever calls `setup()` |
| [sections/best-deal-banner.liquid](sections/best-deal-banner.liquid) | Swiper → `row-slider-component`, autoplay only, no nav buttons (matches prior behavior; the dead nav-button CSS noted in section 5 was dropped rather than ported) |
| [snippets/cart-drawer.liquid](snippets/cart-drawer.liquid) | Both the empty-cart (horizontal, autoplay + nav) and has-cart (vertical, autoplay, no nav) instances migrated; old per-branch `<script>` init blocks removed entirely since the custom element self-initializes from markup |
| [snippets/custom-product-card.liquid](snippets/custom-product-card.liquid) | `swiper-slide` → `row-slider__item` |
| [layout/theme.liquid](layout/theme.liquid) | Swiper `<script>`/`<link>` conditional block removed |
| `assets/swiper-bundle.min.js`, `assets/swiper-bundle.min.css` | Deleted |

A repo-wide case-insensitive search for `swiper` after the migration returns no functional references — only this doc, the FE/BE audit docs, and one explanatory code comment in `recent-viewed.liquid` that references the historical bug by name.

### 8.4 Not yet done / needs manual verification

This was implemented directly in the working tree without a running theme preview (no `shopify theme dev` session in this workflow), so **visual/interaction QA has not been performed**. Before treating this as done, manually check in a real theme preview:

- Hero slider: desktop 3-up centered-scale animation, mobile 1-up, loop wraparound at both ends, rapid click-spam on next/prev (guarded by `isAnimating` but not visually verified), swipe/drag on touch, keyboard arrow navigation, and the theme-editor animation settings actually changing the look live.
- The 4 row sliders: loop wraparound, autoplay pause-on-hover, `recent-viewed`'s async load → `refresh()` path, and the cart-drawer vertical variant specifically (3-per-view vertical scroll-snap is the least battle-tested config in `RowSliderComponent`).
- `prefers-reduced-motion: reduce` in DevTools across both components.
- The clone-based loop boundary math in `RowSliderComponent.checkBoundary()` was written from the standard scroll-snap-infinite-carousel recipe but not unit-tested against every `slidesPerView`/item-count combination (e.g. fewer real items than `cloneCount`, which falls back to `loop` being effectively disabled since `buildClones()` only runs when `realCount > cloneCount`).

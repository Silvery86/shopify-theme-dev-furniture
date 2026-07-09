# Backend Review: Liquid Efficiency, Schema Architecture & Data Fetching

**Theme:** Dawn-based furniture storefront with custom Tailwind sections
**Review date:** July 2026
**Scope:** Custom Liquid logic, section schemas, and JS ↔ Shopify API interactions (Cart API, Section Rendering API, predictive search). Stock Dawn files were spot-checked but are assumed sound; findings below concentrate on the `custom-*` and bespoke files.

---

## Executive Summary

The custom layer is functional but leaks performance in four recurring ways:

1. **Un-paginated Liquid loops** run over the *entire* collection before pagination even starts, defeating Shopify's pagination optimizer.
2. **Global re-initialization of event listeners** (`initializeQuickAddToCart`, `initializeWishlistToggle`) is called on every DOMContentLoaded **and** after every AJAX append. Because each call re-binds listeners to *all* matching elements, listeners accumulate — clicks fire 2×, 3×, N× after "view more" or recent-viewed loads. This is the single highest-impact bug.
3. **Full-page fetches instead of the Section Rendering API.** "View more" pagination downloads the entire page (header, footer, all scripts) and throws away everything except `<li>` nodes.
4. **Schema drift** — several merchant-facing settings render nothing, and hardcoded marketing copy (`$89.00`, "3-year warranty") sits in a block with no settings.

Highest-impact fixes, in order:

| # | Fix | File(s) | Impact |
|---|---|---|---|
| 1 | Replace global re-init with event delegation | `quick-add-to-cart.js`, `wishlist.js` | Fixes duplicate AJAX calls & listener leak |
| 2 | Use Section Rendering API for "view more" | `custom-collection-products-grid.liquid` | ~5–10× smaller responses |
| 3 | Remove pre-pagination `collection.products` loop | `custom-collection-products-grid.liquid` | Avoids loading the full collection |
| 4 | Fix quick-view variant data contract | `quick-add-to-cart.js`, `quick-view-modal.liquid` | Restores variant switching |
| 5 | Prune dead schema settings & hardcoded copy | grid + main-product schemas | Merchant clarity |
| 6 | Responsive images in cards | `custom-product-card.liquid` | Bandwidth / LCP |

---

## Implementation Status — Updated July 2026

All actionable findings below have been implemented. The sections that follow (§1–§4) remain as the original analysis/reference; this table is the source of truth for what shipped.

| # | Finding | Status | Notes |
|---|---|---|---|
| 1.1 | Pre-pagination full-collection loop | ✅ Fixed | Now `limit: 50` + `break` |
| 1.2 | Off-by-one lazy-load threshold | ✅ Fixed | Tied to `columns_desktop` |
| 1.3 | Non-responsive card images | ✅ Fixed | `srcset`/`sizes` + real `width`/`height` + placeholder for no-image products |
| 1.4 | Unconditional compare-at strikethrough | ✅ Fixed | Guarded on `compare_price > current_price` |
| 1.5 | Duplicated swatch markup / missing `block` | ⚠️ Partial | **Functional** part fixed — `swatch_shape` is now an explicit param (`resolved_swatch_shape`), so swatches are no longer shapeless in card context. The two near-identical swatch branches were **deliberately left un-merged** (pure maintainability, higher regression risk than value). |
| 1.6 | Dead `custom-collection-filter.liquid` | ✅ Removed | File deleted (unreferenced by any template; duplicated the working `facets` partial) |
| 2.1 | Dead grid schema settings | ✅ Fixed | `image_ratio` **wired through** to the card; `show_vendor` / `show_rating` **deleted**. `image_shape` kept (still drives mask CSS). |
| 2.2 | Hardcoded `$89.00` / warranty | ✅ Fixed | Installment computed from variant price; `installments` (range) + `warranty_text` settings added. *Known limitation below.* |
| 2.3 | Non-idiomatic recent-viewed setting IDs | ⛔ Skipped (intentional) | Kebab-case IDs are a **theme-wide convention** (`popular_products`, `gallery`, …). Renaming only one section creates inconsistency and resets saved settings in `index.json` / `product.custom-product-page.json`. Low value, real data-loss risk. |
| 2.4 | Duplicated icon `select` | ⛔ Not changed | Inherited Dawn structure; acceptable as-is. |
| 3.1 | Accumulating listeners (re-init) | ✅ Fixed | `wishlist.js` + `quick-add-to-cart.js` rewritten to **document-level delegation**, bound once. `initializeWishlistToggle` → safe repaint alias; `initializeQuickAddToCart` → safe no-op (keeps existing call sites in `cart-drawer.js`, `wishlist.liquid` working). |
| 3.2 | View-more full-page fetch | ✅ Fixed | Section Rendering API (`section_id=…`); error path re-enables button; status text targets `.view-more-status__label`. **Also fixed a latent double-`?` URL bug** (see correction below). |
| 3.3 | "Broken" quick-view variant sync | ✅ Corrected | **Original finding was wrong** — `product-variant-picker.liquid:100` already emits `data-variants-json`, which the quick-view modal renders. Variant switching works. Only cleanup applied: removed the dead `window.quickViewVariants` global and the leftover `console.log`. |
| 3.4 | Refetch on every interaction | ✅ Fixed | Quick-add caches section HTML in a `Map`; recent-viewed caches rendered cards in `sessionStorage` (`rv:<handle>`). |
| 3.5 | Double Swiper init | ✅ Fixed | Removed the premature init on the empty container; Swiper now initializes once, after cards are injected. |
| 3.6 | Unguarded free-ship DOM access | ✅ Fixed | `DOMContentLoaded` + null guard. |
| 3.7 | `add-to-cart-form.js` minor notes | ✅ Fixed | Early return when no `form`; hides modal via `this.closest('#quick-add-to-cart')` instead of the closed-over reference. |
| 4.1 | Wishlist has no global sync | ✅ Fixed | Dispatches `wishlist:change`, updates `[data-wishlist-count]` badges, cross-tab `storage` sync. *(Badge element not yet present in markup — hook is ready for whenever one is added.)* |

### Correction to the original review (§3.2 → new bug found during implementation)

While wiring the Section Rendering API, a **pre-existing latent bug** surfaced in the view-more URL construction:

```liquid
{% assign next_url = paginate.next.url %}
{% if request.query_string != blank %}
  {% assign next_url = paginate.next.url | append: '?' | append: request.query_string %}  {% comment %} BUG {% endcomment %}
{% endif %}
```

`paginate.next.url` **already** ends in `?page=N` and **already preserves** active filters/sort, so appending `?` + `request.query_string` produces a malformed **double-`?`** URL (`/collections/x?page=2?filter…`). This was latent because view-more was evidently only tested on unfiltered collections; the Section Rendering change (which always adds `section_id`) would have made it fire every time. **Fixed** by using `paginate.next.url` directly.

### Second-pass fix — wishlist-page double-toggle (found during re-review)

Moving `wishlist.js` to a **document-level** delegated listener exposed a conflict on the dedicated wishlist page ([sections/wishlist.liquid](../sections/wishlist.liquid)), which had its **own** per-element `.wishlist-toggle` click binding (`initWishlistEvents`). Both handlers fired on the same click → the toggle happened twice → net no-op (the card wouldn't clear).

> This was *not* a problem before, because the old `initializeWishlistToggle` ran at `DOMContentLoaded` when the wishlist grid was still empty, so it never bound there.

**Fixed** by deleting the page's own `initWishlistEvents` binding and having the page instead re-render its grid on the global `wishlist:change` event. The global handler now solely owns toggling/persistence/icon state; the page only reacts to render the updated list. This is a good template for any other page that needs to respond to wishlist changes.

### Known limitations (accepted, by design)

- **Installment price is server-rendered.** The `payment-content` block computes the per-installment amount from the variant price at page render. It does **not** live-update when the shopper switches variants (that block isn't part of the `product-info` re-render). This is still strictly better than the previous hardcoded `$89.00`; a live update would require a small JS subscriber on the `variant:change` pubsub event.
- **`product-color-picker.liquid` still has two near-identical swatch branches** (§1.5). Left intact intentionally.

### Verification performed

- All edited JSON schemas and JS files parse cleanly (`JSON.parse` / `new Function`).
- `shopify theme check`: the ImgWidthAndHeight error introduced mid-implementation was resolved; total offenses **27 → 26**, errors **2 → 1**. The **one remaining error is pre-existing** (`MissingAsset` in `header-main.liquid`, untouched by this work).
- Runtime flows (collection **view-more**, **quick-add** modal, **wishlist** toggle) still need a manual click-through on a dev store — theme-check can't exercise them.

---

## 1. Liquid Efficiency

### 1.1 Pre-pagination full-collection loop (High)

**File:** [sections/custom-collection-products-grid.liquid:25-36](../sections/custom-collection-products-grid.liquid#L25-L36)

```liquid
{%- assign has_variants = false -%}
{% for product in collection.products %}
  {% unless product.has_only_default_variant %}
    {% assign has_variants = true %}
  {% endunless %}
{% endfor %}

{% if has_variants %}
  {{ 'component-product-variant-picker.css' | asset_url | stylesheet_tag }}
  ...
{% endif %}
```

This loop runs **outside** the `{% paginate %}` block (which starts at line 53), so Liquid iterates the *entire* collection — not just the current page — purely to decide whether to emit three `<link>` tags. On a 500-product collection this walks all 500 records and never `break`s.

**Fix — short-circuit with `break`, or (better) just always load the CSS conditionally on the setting.** Cards always render the color picker when `show_variant_picker: true`, so gating on a full scan buys almost nothing. If you keep the scan, break early:

```liquid
{%- assign has_variants = false -%}
{%- for product in collection.products limit: 50 -%}
  {%- unless product.has_only_default_variant -%}
    {%- assign has_variants = true -%}
    {%- break -%}
  {%- endunless -%}
{%- endfor -%}
```

The `limit` + `break` caps the scan; a variant in the first 50 products is enough signal to load the (small) swatch CSS.

---

### 1.2 Off-by-one in lazy-load threshold (Low)

**File:** [sections/custom-collection-products-grid.liquid:167-171](../sections/custom-collection-products-grid.liquid#L167-L171)

```liquid
{% assign lazy_load = false %}
{%- if forloop.index > 2 -%}
  {%- assign lazy_load = true -%}
{%- endif -%}
```

`forloop.index` is 1-based, so this eagerly loads the first **two** images. For a 4-across grid the entire first row above the fold should be eager; for a 2-across grid two is correct. Tie the threshold to `columns_desktop` instead of a magic `2`:

```liquid
{%- assign eager_count = section.settings.columns_desktop -%}
{%- assign lazy_load = false -%}
{%- if forloop.index > eager_count -%}{%- assign lazy_load = true -%}{%- endif -%}
```

---

### 1.3 Non-responsive card images (Medium)

**File:** [snippets/custom-product-card.liquid:16-44](../snippets/custom-product-card.liquid#L16-L44)

```liquid
<img
  class="product-main-image ... aspect-[2/1]"
  src="{{ card_product.selected_or_first_available_variant.featured_media | image_url: width: 300 | default: card_product.featured_image }}"
  width="300"
  height="150"
  ...
>
```

Problems:

- **Single fixed `width: 300`** — no `srcset`/`sizes`, so retina displays get a blurry image and a 1-column mobile card (≈380 px) is upscaled. Dawn's own cards use responsive `srcset`.
- **`| default:` is misplaced.** `image_url` of a `nil` media returns an empty string, and `default` then falls back to an *image object* (`card_product.featured_image`), not a URL — the fallback renders the object's `.src` only by luck of `to_string`. Compute the media first, then build the URL.
- **`aspect-[2/1]` with `height="150"`** hardcodes 2:1 but the schema exposes an `image_ratio` setting (see §2.1) that is never honored.

**Fix:**

```liquid
{%- assign card_media = card_product.selected_or_first_available_variant.featured_media | default: card_product.featured_media -%}
<img
  class="product-main-image w-full object-cover ..."
  {% if card_media %}
    src="{{ card_media | image_url: width: 400 }}"
    srcset="{{ card_media | image_url: width: 200 }} 200w,
            {{ card_media | image_url: width: 400 }} 400w,
            {{ card_media | image_url: width: 600 }} 600w"
    sizes="(min-width: 750px) 25vw, 50vw"
    width="{{ card_media.width }}"
    height="{{ card_media.height }}"
  {% endif %}
  alt="{{ card_product.title | escape }}"
  {% if lazy_load %}loading="lazy"{% endif %}
>
```

---

### 1.4 Unconditional compare-at strikethrough (Low)

**File:** [snippets/custom-product-card.liquid:53-56](../snippets/custom-product-card.liquid#L53-L56)

```liquid
<div class="product__price ...">
  {{ card_product.price | money }}
  <span class="line-through ...">{{ card_product.compare_at_price | money }}</span>
</div>
```

The strikethrough `<span>` renders even when there's no discount. When `compare_at_price` is `nil` it prints the store's zero-value money string (e.g. `$0.00`) or an empty node that still occupies layout. Guard it and reuse the discount check already computed at line 7:

```liquid
<div class="product__price ...">
  {{ card_product.price | money }}
  {%- if card_product.compare_at_price > card_product.price -%}
    <span class="line-through text-gray-600 text-[12px]">{{ card_product.compare_at_price | money }}</span>
  {%- endif -%}
</div>
```

---

### 1.5 Duplicated swatch markup in the color picker (Medium — maintainability)

**File:** [snippets/product-color-picker.liquid:27-148](../snippets/product-color-picker.liquid#L27-L148)

The `swatch_color_only == true` branch (lines 27–88) and the `swatch_color_only == false … 'swatch'` branch (lines 89–148) are **~60 lines of near-identical markup** differing only by the outer condition. This triples the surface area for bugs and is re-parsed for every product card in a grid.

Also note this snippet references `block.settings.swatch_shape` and `block.shopify_attributes` — but in the collection-card context there is **no `block`**, so `shape` is `nil` and swatches render shapeless. Pass an explicit `swatch_shape` param from the caller instead of relying on `block`.

**Fix:** collapse the two swatch branches into one and compute a boolean up top:

```liquid
{%- assign render_swatch = false -%}
{%- if picker_type == 'swatch' and (swatch_color_only or swatch_color_only == false) -%}
  {%- assign render_swatch = true -%}
{%- endif -%}
{%- if render_swatch -%}
  {%- for value in option.values -%}
    {%- if swatch_color_only == false or value.swatch.color -%}
      ... single copy of the swatch-input render ...
    {%- endif -%}
  {%- endfor -%}
{%- endif -%}
```

Add a `swatch_shape` parameter to the snippet's documented `Accepts:` list and pass `shape: swatch_shape | default: 'circle'` to `swatch-input`.

---

### 1.6 Dead, non-functional filter section (High — remove or implement)

**File:** [sections/custom-collection-filter.liquid](../sections/custom-collection-filter.liquid) (entire file)

```liquid
<select class="border px-4 py-2 rounded">
  <option>Most popular</option>
  <option>Newest</option>
  ...
</select>
...
<button class="border px-4 py-2 rounded">Category ({{ collection.tags.size }})</button>
<!-- You could use JavaScript or Metafields to show checkboxes or pills dynamically -->
{% for tag in collection.tags %}
  <span class="bg-gray-200 ...">{{ tag }}</span>
{% endfor %}
```

None of these `<select>`s have a `name`, `form`, or JS handler — they change nothing. The tag loop iterates *every* tag on the collection (can be hundreds) to render inert pills, and the "Clear all" link points at `collection.url` while nothing was ever applied. This is a merchant footgun: it looks like filtering but silently does nothing, and it duplicates the real, working `{% render 'facets' %}` already wired up in `custom-collection-products-grid.liquid`.

**Recommendation:** delete this section, or replace its body with the real facets partial:

```liquid
{% render 'facets', results: collection, enable_filtering: true, enable_sorting: true, filter_type: 'horizontal' %}
```

---

## 2. Schema Architecture

### 2.1 Dead settings in the product-grid schema (Medium)

**File:** [sections/custom-collection-products-grid.liquid:310-538](../sections/custom-collection-products-grid.liquid#L310-L538)

The schema exposes these merchant controls, but the section's `{% render 'custom-product-card' %}` call (lines 178-184) only passes `show_secondary_image`, `lazy_load`, `show_add_to_cart`, `show_variant_picker`:

| Setting | Declared | Actually used? |
|---|---|---|
| `image_ratio` | ✅ line 361 | ❌ never passed to the card |
| `image_shape` | ✅ line 381 | ⚠️ only `arch`/`blob` CSS is loaded; card ignores the value |
| `show_vendor` | ✅ line 427 | ❌ card has no vendor markup |
| `show_rating` | ✅ line 433 | ❌ card has no rating markup |

A merchant toggling "Show vendor" or changing image ratio sees **no effect**, which erodes trust in the editor. Either:

- **Wire them through** — pass `image_ratio: section.settings.image_ratio, show_vendor: section.settings.show_vendor, …` and honor them in `custom-product-card.liquid`; or
- **Delete the settings** you don't intend to support.

Prefer wiring `image_ratio` (cheap, high value) and deleting `show_vendor`/`show_rating`/`image_shape` unless the card is extended.

---

### 2.2 Hardcoded marketing copy in a settings-less block (High — correctness)

**File:** [sections/custom-main-product.liquid:498-518](../sections/custom-main-product.liquid#L498-L518)

```liquid
{%- when 'payment-content' -%}
  <p>Pay 4 interest-free payments of <span class="font-bold">$89.00</span> with</p>
  <p class="mt-1">We provide a <span class="font-semibold">3-year warranty</span> ...</p>
```

The `payment-content` block schema (lines 821-825) declares `"settings": []`. The `$89.00` and "3-year warranty" are **hardcoded** and shown on every product regardless of price. This is factually wrong for any product not priced at $356, and merchants can't fix it.

**Fix:** either compute the installment from the real price, or expose settings:

```liquid
{%- assign installment = product.selected_or_first_available_variant.price | divided_by: 4 | money -%}
<p>Pay 4 interest-free payments of <span class="font-bold">{{ installment }}</span> with</p>
<p class="mt-1">We provide a <span class="font-semibold">{{ block.settings.warranty_text | default: '3-year warranty' }}</span></p>
```

And add a `text`/`richtext` setting to the block schema so the warranty line is editable.

---

### 2.3 Non-idiomatic setting IDs (Low)

**File:** [sections/recent-viewed.liquid:186-210](../sections/recent-viewed.liquid#L186-L210)

IDs use kebab-case and double underscores (`recent-viewed__title`, `products-per-slide-desktop`), forcing bracket access (`section.settings['recent-viewed__title']`, line 5) and `section.settings.products-per-slide-desktop` which Liquid parses as *subtraction* in some contexts. Shopify convention is `snake_case` (`title`, `products_per_slide_desktop`). Rename for safety and consistency; the dot access then works normally.

---

### 2.4 Icon `select` duplicated verbatim (Low — maintainability)

**File:** [sections/custom-main-product.liquid](../sections/custom-main-product.liquid) — the 44-option `icon` select is copy-pasted between the `collapsible_tab` block (lines 1096-1279) and the `complementary` block (lines 1342-1520+). This ~360-line duplication is inherited from Dawn's structure, so it's acceptable, but if you extend it, factor the option list into a shared locale-referenced schema or accept the duplication knowingly.

---

## 3. API & Data Fetching

### 3.1 Accumulating event listeners via global re-init (Critical)

**Files:** [assets/quick-add-to-cart.js:1-38](../assets/quick-add-to-cart.js#L1-L38), [assets/wishlist.js:1-55](../assets/wishlist.js#L1-L55)

Both files export a function that queries **all** matching elements and attaches listeners:

```js
function initializeQuickAddToCart() {
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', function (e) { ... fetch(...) ... });
  });
  document.querySelector('.close-modal').addEventListener('click', ...); // also no null check
}
```

These functions are called from **multiple places**:

- `DOMContentLoaded` (both files, self-invoked)
- After each "view more" append — [custom-collection-products-grid.liquid:297-306](../sections/custom-collection-products-grid.liquid#L297-L306)
- After recent-viewed loads — [recent-viewed.liquid:159-160](../sections/recent-viewed.liquid#L159-L160)

Every call **re-binds** already-bound buttons. After one "view more" click, existing cards have **two** click listeners; after two, **three**. Result:

- **Quick-add:** a single click fires the modal fetch 2–N times → duplicate `/products/{handle}?sections=…` round-trips.
- **Wishlist:** a click toggles the item add→remove in the same tick → **net no-op** (the item never gets saved).
- `document.querySelector('.close-modal')` throws if the element is absent and stacks duplicate close handlers each call.

**Fix — one delegated listener, bound once, at document level.** Delegation automatically covers dynamically-appended cards, so the re-init calls can be deleted entirely:

```js
// quick-add-to-cart.js — bind ONCE
document.addEventListener('click', (e) => {
  const button = e.target.closest('.add-to-cart-btn');
  if (button) { e.preventDefault(); openQuickAdd(button.dataset.productHandle); return; }

  if (e.target.closest('.close-modal') || e.target.closest('#quick-add-to-cart__overlay')) {
    closeQuickAdd();
  }
});

const quickAddCache = new Map(); // 3.4: cache section HTML per handle

function openQuickAdd(handle) {
  document.querySelector('cart-drawer')?.close();
  const render = (html) => { /* inject + show modal + init form/sync */ };
  if (quickAddCache.has(handle)) return render(quickAddCache.get(handle));

  fetch(`/products/${handle}?sections=quick-view-modal`)
    .then(r => { if (!r.ok) throw new Error(`Failed: ${handle}`); return r.json(); })
    .then(data => { const html = data['quick-view-modal'] || ''; quickAddCache.set(handle, html); render(html); })
    .catch(console.error);
}
```

Then **remove** the `initializeQuickAddToCart()` / `initializeWishlistToggle()` calls from the view-more and recent-viewed scripts. Apply the same delegation pattern to `wishlist.js`:

```js
// wishlist.js — bind once; read localStorage once per click, not per button
const KEY = 'wishlist';
const readList = () => JSON.parse(localStorage.getItem(KEY) || '[]');

document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.wishlist-toggle');
  if (!toggle) return;
  const handle = toggle.dataset.productHandle;
  let list = readList();
  const isIn = list.includes(handle);
  list = isIn ? list.filter(h => h !== handle) : [handle, ...list];
  localStorage.setItem(KEY, JSON.stringify(list));
  toggle.querySelector('.heart-icon').src = isIn ? window.wishlistIcons.empty : window.wishlistIcons.filled;
  document.dispatchEvent(new CustomEvent('wishlist:change', { detail: { count: list.length } })); // see §4.1
});

// Paint initial icon state for whatever is in the DOM now and after AJAX (idempotent — sets src, adds no listeners)
function paintWishlistIcons(root = document) {
  const list = readList();
  root.querySelectorAll('.wishlist-toggle').forEach(t => {
    t.querySelector('.heart-icon').src = list.includes(t.dataset.productHandle)
      ? window.wishlistIcons.filled : window.wishlistIcons.empty;
  });
}
document.addEventListener('DOMContentLoaded', () => paintWishlistIcons());
```

`paintWishlistIcons()` is safe to call after AJAX appends because it only sets `img.src` — it never binds listeners.

---

### 3.2 "View more" downloads the whole page (High)

**File:** [sections/custom-collection-products-grid.liquid:238-303](../sections/custom-collection-products-grid.liquid#L238-L303)

```js
fetch(nextUrl)                       // nextUrl = /collections/x?page=2&...
  .then(r => r.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newItems = doc.querySelectorAll('#product-grid > li');
    ...
  });
```

This fetches the **entire** next page — `<head>`, header, footer, every `<script>`/`<link>` — then discards all but the `<li>` grid items. For a typical page that's ~200–400 KB parsed to keep ~20 KB.

**Fix:** request only this section via the Section Rendering API by appending `section_id`:

```js
const url = new URL(nextUrl, location.origin);
url.searchParams.set('section_id', '{{ section.id }}');   // inline the section id from Liquid
fetch(url)
  .then(r => r.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newItems = doc.querySelectorAll('#product-grid > li');
    ...
  });
```

The response is now just this section's markup — typically 5–10× smaller and faster to parse. (Keep the same `<li>` extraction logic.) Also harden the two failure UX gaps:

- The `.catch()` only calls `button.remove()`, silently killing pagination on a transient network blip. Re-enable the button and show a retry state instead.
- `statusText.firstChild.textContent = …` (line 282) assumes the first child node is text; after the DOM mutates this can write into the wrong node. Target a dedicated `<span>` you control.

---

### 3.3 Broken variant sync in quick view — data contract mismatch (High — correctness)

**Files:** [assets/quick-add-to-cart.js:70-129](../assets/quick-add-to-cart.js#L70-L129), [snippets/quick-view-modal.liquid:37-39](../snippets/quick-view-modal.liquid#L37-L39)

`initQuickViewVariantSync` looks for a `[data-variants-json]` element:

```js
const variantJsonScript = modal.querySelector('[data-variants-json]');
...
if (allVariants.length === 0) {
  allVariants = [JSON.parse(variantDataScript.textContent)]; // falls back to ONE variant
}
```

But the quick-view snippet emits the full variant list under a **different** name:

```liquid
<script>window.quickViewVariants = {{ product.variants | json }};</script>
```

Nothing ever emits `[data-variants-json]`, so `allVariants` falls back to the single selected variant. Switching a swatch then finds no match for any other option combination → the hidden `id` input never updates → **the customer adds the wrong (initial) variant to cart.**

**Fix:** emit the array with the attribute the JS expects (and drop the global):

```liquid
<script type="application/json" data-variants-json>
  {{ product.variants | json }}
</script>
```

Also remove the leftover `console.log("Variant updated:", …)` at line 123, and note `first_3d_model` (line 46) is referenced but never assigned in this snippet, so the 3D-model branch is dead.

---

### 3.4 Quick-view / recent-viewed refetch on every interaction (Medium)

- **Quick-add** re-fetches `/products/{handle}?sections=quick-view-modal` every time a card's button is clicked, even for a product already opened. Cache the returned HTML in a `Map` keyed by handle (shown in §3.1).
- **Recent-viewed** ([recent-viewed.liquid:107-161](../sections/recent-viewed.liquid#L107-L161)) fires up to **8 parallel** `fetch(/products/{handle}?sections=custom-product-card)` calls on every page load — 8 server round-trips rendering a full section each. Consider persisting the rendered card HTML in `sessionStorage` keyed by handle so repeat navigation is instant:

```js
async function fetchCard(handle) {
  const cached = sessionStorage.getItem(`rv:${handle}`);
  if (cached) return cached;
  const res = await fetch(`/products/${handle}?sections=custom-product-card`);
  if (!res.ok) return '';
  const html = (await res.json())['custom-product-card'] || '';
  const inner = new DOMParser().parseFromString(html, 'text/html')
    .querySelector('#shopify-section-custom-product-card')?.innerHTML || html;
  sessionStorage.setItem(`rv:${handle}`, inner);
  return inner;
}
```

---

### 3.5 Double Swiper initialization (Medium)

**File:** [sections/recent-viewed.liquid:19-42](../sections/recent-viewed.liquid#L19-L42) and [147-158](../sections/recent-viewed.liquid#L147-L158)

Swiper is initialized **twice** on the same `.recent-viewed__slider`:

1. In `<script async>` on `DOMContentLoaded` — but the container is **empty** at that moment (products load asynchronously afterward), so it initializes on nothing, and with `loop: true` on zero slides.
2. Again inside the `Promise.all(...).then()` after cards are injected — **without destroying** the first instance.

Two live Swiper instances bind to the same DOM: duplicated event handlers, broken loop/navigation, wasted work.

**Fix:** delete the first (empty) init entirely. Initialize Swiper exactly once, after the cards are in the DOM. If you ever re-run it, call `existing?.destroy(true, true)` first.

---

### 3.6 Unguarded DOM access in free-ship script (Low)

**File:** [assets/freeship-content.js:1-12](../assets/freeship-content.js#L1-L12)

```js
document.getElementById('shipping-date-range').textContent = dateRangeText;
```

Runs at module top level with no null check and no `DOMContentLoaded` guard. The snippet loads it with `defer`, so the element usually exists — but if the block is placed after the script, or the element is renamed, this throws and aborts the script. The dates are also computed in the **browser's** timezone, not the store's. Guard it:

```js
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('shipping-date-range');
  if (el) el.textContent = dateRangeText;
});
```

---

### 3.7 `add-to-cart-form.js` — sound, minor notes (Low)

[assets/add-to-cart-form.js](../assets/add-to-cart-form.js) correctly uses the Cart AJAX API with the sections-rendering payload (`formData.append('sections', …)`) and publishes `cartUpdate`/`cartError` via pubsub — good. Two small notes:

- The custom element is defined once (`if (!customElements.get('add-to-cart-form'))`), so `modalElement` from the **first** `initializeAddToCartForm(modalElement)` call is the one captured in the closure at line 99. This works only because the quick-add modal is a singleton (`#quick-add-to-cart`). If a second modal element is ever introduced, `modalElement.classList.add('hidden')` will hide the wrong node. Prefer `this.closest('.modal')` over the closed-over reference.
- The constructor touches `this.variantIdInput.disabled` (line 10) before confirming `this.form` exists; a malformed modal body would throw in the constructor. Add an early `if (!this.form) return;`.

---

## 4. Caching & State

### 4.1 Wishlist state has no global sync (Medium)

Wishlist lives only in `localStorage` and is read/written per-button. There's no event broadcast, so a header wishlist **count badge** (if present) never updates on toggle, and other open tabs drift out of sync. The §3.1 rewrite dispatches a `wishlist:change` event — subscribe to it wherever the count is shown, and also listen to the native cross-tab `storage` event:

```js
function renderWishlistCount(n) {
  const badge = document.querySelector('[data-wishlist-count]');
  if (badge) { badge.textContent = n; badge.hidden = n === 0; }
}
document.addEventListener('wishlist:change', (e) => renderWishlistCount(e.detail.count));
window.addEventListener('storage', (e) => {
  if (e.key === 'wishlist') renderWishlistCount(JSON.parse(e.newValue || '[]').length);
});
```

### 4.2 Cart count / state (context)

The stock add-to-cart path (`add-to-cart-form.js`) already updates cart sections through the Section Rendering payload and `cart.renderContents(response)`, so the bubble and drawer stay consistent — keep this. The risk is only in **custom** paths: if any bespoke add flow calls `/cart/add.js` **without** passing `sections`, the header bubble will go stale. Audit that every custom add path includes the `sections`/`sections_url` payload like `add-to-cart-form.js` does.

### 4.3 Prefer delegation over re-init as a caching strategy

The recurring `initializeX()`-after-every-AJAX pattern is the root cause of §3.1. Document-level delegation (bind once) is both the correctness fix **and** the efficiency win: no repeated `querySelectorAll` over a growing DOM, no listener accumulation, and newly injected cards "just work." Treat "call `initializeX()` again" as a code smell in this codebase.

### 4.4 Server-side Liquid caching notes

- Custom sections avoid `include` (deprecated) in favor of `render` — good; `render` gives Shopify a clean, cacheable variable scope. Keep it.
- Inline `{%- style -%}` blocks keyed by `section.id` (grid line 38, main-product line 28) are fine and standard Dawn.
- The pre-pagination loop in §1.1 is the main server-side cost worth removing.

---

## Appendix — File-by-file quick index

| File | Findings |
|---|---|
| `sections/custom-collection-products-grid.liquid` | §1.1 full-collection loop, §1.2 lazy threshold, §2.1 dead settings, §3.2 full-page fetch |
| `sections/custom-collection-filter.liquid` | §1.6 non-functional dead section |
| `snippets/custom-product-card.liquid` | §1.3 non-responsive images, §1.4 unconditional strikethrough |
| `snippets/product-color-picker.liquid` | §1.5 duplicated markup, missing `block` context |
| `sections/custom-main-product.liquid` | §2.2 hardcoded price/warranty copy |
| `sections/recent-viewed.liquid` | §2.3 setting IDs, §3.4 refetch, §3.5 double Swiper |
| `assets/quick-add-to-cart.js` | §3.1 listener leak, §3.3 variant sync, §3.4 no cache |
| `assets/wishlist.js` | §3.1 listener leak, §4.1 no global sync |
| `snippets/quick-view-modal.liquid` | §3.3 variant data contract |
| `assets/freeship-content.js` | §3.6 unguarded DOM access |
| `assets/add-to-cart-form.js` | §3.7 minor closure/constructor notes (otherwise sound) |

(function () {
  const wishlistKey = 'wishlist';

  function getWishlist() {
    try {
      return JSON.parse(localStorage.getItem(wishlistKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(list) {
    localStorage.setItem(wishlistKey, JSON.stringify(list));
  }

  // Repaint heart icons to match stored state. Safe to call repeatedly (e.g.
  // after AJAX appends) because it only sets `img.src` — it never binds listeners.
  function paintWishlistIcons(root) {
    if (!window.wishlistIcons) return;
    root = root || document;
    const list = getWishlist();
    root.querySelectorAll('.wishlist-toggle').forEach((toggle) => {
      const img = toggle.querySelector('.heart-icon');
      if (!img) return;
      const handle = toggle.getAttribute('data-product-handle');
      img.src = list.includes(handle) ? window.wishlistIcons.filled : window.wishlistIcons.empty;
    });
  }

  function renderWishlistCount(count) {
    document.querySelectorAll('[data-wishlist-count]').forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
    });
  }

  // One delegated click listener, bound a single time. Covers dynamically
  // appended cards (view-more, recent-viewed) without re-binding.
  document.addEventListener('click', function (e) {
    const toggle = e.target.closest('.wishlist-toggle');
    if (!toggle) return;
    e.preventDefault();

    const handle = toggle.getAttribute('data-product-handle');
    let list = getWishlist();
    const isInWishlist = list.includes(handle);
    list = isInWishlist ? list.filter((h) => h !== handle) : [handle, ...list];
    saveWishlist(list);

    const img = toggle.querySelector('.heart-icon');
    if (img && window.wishlistIcons) {
      img.src = isInWishlist ? window.wishlistIcons.empty : window.wishlistIcons.filled;
    }

    renderWishlistCount(list.length);
    document.dispatchEvent(new CustomEvent('wishlist:change', { detail: { count: list.length } }));
  });

  // Cross-tab sync: another tab changed the wishlist.
  window.addEventListener('storage', function (e) {
    if (e.key !== wishlistKey) return;
    paintWishlistIcons();
    renderWishlistCount(getWishlist().length);
  });

  document.addEventListener('DOMContentLoaded', function () {
    paintWishlistIcons();
    renderWishlistCount(getWishlist().length);
  });

  // Public API. `initializeWishlistToggle` is kept as a backward-compatible
  // alias (called from cart-drawer.js, wishlist.liquid, etc.) but now only
  // repaints icon state — it no longer stacks listeners.
  window.paintWishlistIcons = paintWishlistIcons;
  window.initializeWishlistToggle = paintWishlistIcons;
})();

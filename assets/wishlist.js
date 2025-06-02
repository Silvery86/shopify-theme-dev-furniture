document.addEventListener('DOMContentLoaded', function () {
  const wishlistKey = 'wishlist';

  function getWishlist() {
    const list = localStorage.getItem(wishlistKey);
    return list ? JSON.parse(list) : [];
  }

  function saveWishlist(list) {
    localStorage.setItem(wishlistKey, JSON.stringify(list));
  }

  // Toggle heart icon src
  function updateHeartIcon(imgEl, isAdded) {
      if (isAdded) {
        imgEl.src = window.wishlistIcons.filled;
      } else {
        imgEl.src = window.wishlistIcons.empty;
      }
    }

  // Initialize all wishlist toggle buttons
  document.querySelectorAll('.wishlist-toggle').forEach(link => {
    const productId = link.getAttribute('data-product-id');
    const img = link.querySelector('.heart-icon');
    const wishlist = getWishlist();
    const isInWishlist = wishlist.includes(productId);

    // Set icon on page load
    updateHeartIcon(img, isInWishlist);

    // Click event
    link.addEventListener('click', function (e) {
      e.preventDefault();
      let wishlist = getWishlist();

      if (wishlist.includes(productId)) {
        // Remove from wishlist
        wishlist = wishlist.filter(id => id !== productId);
        updateHeartIcon(img, false);
      } else {
        // Add to wishlist
        wishlist.push(productId);
        updateHeartIcon(img, true);
      }

      saveWishlist(wishlist);
    });
  });
});


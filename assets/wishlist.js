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
    const productHandle = link.getAttribute('data-product-handle');
    const img = link.querySelector('.heart-icon');
    const wishlist = getWishlist();
    const isInWishlist = wishlist.includes(productHandle);

    // Set icon on page load
    updateHeartIcon(img, isInWishlist);

    // Click event
    link.addEventListener('click', function (e) {
      e.preventDefault();
      let wishlist = getWishlist();

      if (wishlist.includes(productHandle)) {
        // Remove from wishlist
        wishlist = wishlist.filter(id => id !== productHandle);
        updateHeartIcon(img, false);
      } else {
        // Add to wishlist
        wishlist.push(productHandle);
        updateHeartIcon(img, true);
      }

      saveWishlist(wishlist);
    });
  });
});


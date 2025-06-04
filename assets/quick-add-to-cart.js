function initializeQuickAddToCart() {
  // Event listener for Add to Cart button
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();

      const productHandle = button.getAttribute('data-product-handle');

      // Fetch product data to display in the modal
      fetch(`/products/${productHandle}?sections=quick-view-modal`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load product: ${productHandle}`);
          }
          return response.json();
        })
        .then(data => {
          const htmlString = data['quick-view-modal'] || '';
          const modal = document.getElementById('quick-add-to-cart');
          const modalBody = modal.querySelector('.modal-body');

          // Inject the fetched HTML into the modal body
          modalBody.innerHTML = htmlString;

          // Show the modal
          modal.classList.remove('hidden');
          modal.classList.add('flex')
        })
        .catch(error => {
          console.error(error);
        });
    });
  });

  // Event listener for closing the modal
  document.querySelector('.close-modal').addEventListener('click', function () {
    const modal = document.getElementById('quick-add-to-cart');
    modal.classList.add('hidden'); 
    modal.classList.remove('flex');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initializeQuickAddToCart();
});

(function () {
  // Cache rendered quick-view section HTML per product handle so re-opening the
  // same product doesn't hit the network again.
  const quickAddCache = new Map();

  function getModal() {
    return document.getElementById('quick-add-to-cart');
  }

  function closeQuickAdd() {
    const modal = getModal();
    if (!modal) return;
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.remove('translate-y-0', 'opacity-100');
      modalContent.classList.add('translate-y-[100%]', 'opacity-0');
    }
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);
  }

  function showQuickAdd(htmlString) {
    const modal = getModal();
    if (!modal) return;
    const modalBody = modal.querySelector('.modal-body');
    const modalContent = modal.querySelector('.modal-content');
    if (!modalBody || !modalContent) return;

    modalBody.innerHTML = htmlString;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    modalContent.classList.remove('translate-y-[100%]', 'opacity-0');
    modalContent.classList.add('translate-y-0', 'opacity-100');

    initializeAddToCartForm(modal);
    initQuickViewVariantSync(modal);
  }

  function openQuickAdd(productHandle) {
    if (!productHandle) return;

    const cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer) cartDrawer.close();

    if (quickAddCache.has(productHandle)) {
      showQuickAdd(quickAddCache.get(productHandle));
      return;
    }

    fetch(`/products/${productHandle}?sections=quick-view-modal`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load product: ${productHandle}`);
        }
        return response.json();
      })
      .then((data) => {
        const htmlString = data['quick-view-modal'] || '';
        quickAddCache.set(productHandle, htmlString);
        showQuickAdd(htmlString);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  // Single delegated listener bound once. Works for dynamically appended cards
  // (view-more, recent-viewed) with no re-binding, and safely handles the case
  // where the close button / overlay isn't present.
  document.addEventListener('click', function (e) {
    const addButton = e.target.closest('.add-to-cart-btn');
    if (addButton) {
      e.preventDefault();
      openQuickAdd(addButton.getAttribute('data-product-handle'));
      return;
    }

    if (e.target.closest('.close-modal') || e.target.closest('#quick-add-to-cart__overlay')) {
      closeQuickAdd();
    }
  });

  // Backward-compatible no-op: delegation already covers every current and
  // future `.add-to-cart-btn`, so callers no longer need to re-initialize.
  window.initializeQuickAddToCart = function () {};
})();

function initQuickViewVariantSync(modal) {
  const form = modal.querySelector('form[id^="product-form"]');
  if (!form) {
    return;
  }

  const variantIdInput = form.querySelector('input[name="id"]');
  const variantDataScript = modal.querySelector('[data-selected-variant]');
  const variantJsonScript = modal.querySelector('[data-variants-json]');

  if (!variantIdInput || !variantDataScript) {
    return;
  }

  let allVariants = [];
  try {
    if (variantJsonScript) {
      const parsed = JSON.parse(variantJsonScript.textContent);
      if (Array.isArray(parsed)) {
        allVariants = parsed;
      } else {
        console.warn("VariantJsonScript is not an array:", parsed);
      }
    }
  } catch (err) {
    console.error("Failed to parse variant JSON", err);
  }

  if (allVariants.length === 0) {
    try {
      allVariants = [JSON.parse(variantDataScript.textContent)];
    } catch (err) {
      console.error("Failed to parse selected variant", err);
    }
  }

  const optionInputs = modal.querySelectorAll('input[type="radio"][data-option-value-id]');

  optionInputs.forEach(input => {
    input.addEventListener('change', () => {
      const selectedOptions = Array.from(optionInputs)
        .filter(i => i.checked)
        .map(i => i.value.trim());

      const matchedVariant = allVariants.find(v =>
        v.options.length === selectedOptions.length &&
        v.options.every((opt, idx) =>
          opt?.trim().toLowerCase() === selectedOptions[idx]?.trim().toLowerCase()
        )
      );

      if (matchedVariant) {
        variantIdInput.value = matchedVariant.id;
      } else {
        console.warn("No matching variant found for:", selectedOptions);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initializeQuickAddToCart();
});

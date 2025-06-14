function initializeQuickAddToCart() {
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const productHandle = button.getAttribute('data-product-handle');
      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        cartDrawer.close();
      }
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
          const modalContent = modal.querySelector('.modal-content');

          modalBody.innerHTML = htmlString;

          modal.classList.remove('hidden');
          modal.classList.add('flex');

          modalContent.classList.remove('translate-y-[100%]', 'opacity-0');
          modalContent.classList.add('translate-y-0', 'opacity-100'); 

          initializeAddToCartForm(modal);
          initQuickViewVariantSync(modal);
        })
        .catch(error => {
          console.error(error);
        });
    });
  });

  document.querySelector('.close-modal').addEventListener('click', function () {
    const modal = document.getElementById('quick-add-to-cart');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.classList.remove('translate-y-0', 'opacity-100');
    modalContent.classList.add('translate-y-[100%]', 'opacity-0');
    
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);  
  });

  const overlay = document.getElementById('quick-add-to-cart__overlay');
  if (overlay) {
    overlay.addEventListener('click', function () {
      const modal = document.getElementById('quick-add-to-cart');
      const modalContent = modal.querySelector('.modal-content');

      modalContent.classList.remove('translate-y-0', 'opacity-100');
      modalContent.classList.add('translate-y-[100%]', 'opacity-0');
      
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }, 300); 
    });
  }
}

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
        console.log("Variant updated:", matchedVariant.id);
      } else {
        console.warn("No matching variant found for:", selectedOptions);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initializeQuickAddToCart();
});

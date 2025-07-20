document.addEventListener('DOMContentLoaded', () => {
    const sliderEl = document.querySelector('.hero-slider__slider');
    const productCache = {};
    const LS_KEY = 'heroSliderProducts';
    const CACHE_TTL = 1000 * 60 * 60;

    if (!sliderEl || typeof Swiper === 'undefined') return;

    function loadCacheFromStorage() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return false;
            const { timestamp, data } = JSON.parse(raw);
            if (Date.now() - timestamp > CACHE_TTL) {
                localStorage.removeItem(LS_KEY);
                return false;
            }
            Object.assign(productCache, data);
            return true;
        } catch {
            return false;
        }
    }

    function saveCacheToStorage() {
        try {
            localStorage.setItem(
                LS_KEY,
                JSON.stringify({ timestamp: Date.now(), data: productCache })
            );
        } catch { }
    }

    function getAllHandles() {
        return Array.from(sliderEl.querySelectorAll('.swiper-slide'))
            .map((s) => s.dataset.handle)
            .filter(Boolean)
            .filter((h, i, arr) => arr.indexOf(h) === i);
    }

    function formatMoney(cents) {
        const amt = (cents / 100).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return window.currencyFormat
            ? window.currencyFormat.replace('{{amount}}', amt)
            : `${amt} $`;
    }

    function prefetchProducts() {
        const handles = getAllHandles();
        return Promise.all(
            handles.map(handle => {
                if (productCache[handle]) return Promise.resolve();
                return fetch(`/products/${handle}.js`)
                    .then(r => r.json())
                    .then(product => {
                        const v = product.variants[0];
                        productCache[handle] = {
                            title: product.title,
                            price: v.price,
                            url: product.url
                        };
                    })
                    .catch(err => console.error('Prefetch error:', handle, err));
            })
        ).then(saveCacheToStorage);
    }

    function updateSlideInfo(handle) {
        const info = productCache[handle];
        const container = document.querySelector('.hero-slider__content');
        if (!info || !container) return;
        const titleEl = container.querySelector('.product__title');
        const priceEl = container.querySelector('.product__price');
        const linkEl = container.querySelector('.product__link-btn');

        titleEl && (titleEl.textContent = info.title);
        priceEl && (priceEl.textContent = formatMoney(info.price));
        linkEl && (linkEl.href = info.url);
    }

    function refreshProductsIfChanged() {
        const handles = getAllHandles();
        const fetches = handles.map(handle =>
            fetch(`/products/${handle}.js`)
                .then(r => r.json())
                .then(product => {
                    const v = product.variants[0];
                    return {
                        handle,
                        data: {
                            title: product.title,
                            price: v.price,
                            url: product.url
                        }
                    };
                })
                .catch(err => {
                    console.error('Refresh error for', handle, err);
                    return null;
                })
        );

        Promise.all(fetches).then(results => {
            let changed = false;
            const newCache = {};
            results.forEach(rec => {
                if (!rec) return;
                newCache[rec.handle] = rec.data;
                const old = productCache[rec.handle];
                if (
                    !old ||
                    old.title !== rec.data.title ||
                    old.price !== rec.data.price ||
                    old.url !== rec.data.url
                ) {
                    changed = true;
                }
            });
            if (!changed) return;
            Object.assign(productCache, newCache);
            saveCacheToStorage();

            const activeHandle = swiper.slides[swiper.activeIndex].dataset.handle;
            if (newCache[activeHandle]) {
                updateSlideInfo(activeHandle);
            }
            console.log('HeroSlider cache refreshed.');
        });
    }

    setInterval(refreshProductsIfChanged, 300000);

    const swiper = new Swiper(sliderEl, {
        slidesPerView: 3,
        centeredSlides: true,
        loop: true,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        breakpoints: { 0: { slidesPerView: 1 }, 768: { slidesPerView: 3 } },
        speed: 600,
        on: {
            init() {
                const handle = this.slides[this.activeIndex].dataset.handle;

                if (loadCacheFromStorage() && productCache[handle]) {
                    updateSlideInfo(handle);
                }

                prefetchProducts().then(() => {
                    updateSlideInfo(this.slides[this.activeIndex].dataset.handle);
                });
            },
            slideChange() {
                const handle = this.slides[this.activeIndex].dataset.handle;
                updateSlideInfo(handle);
            }
        }
    });
});
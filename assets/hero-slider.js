class HeroSliderComponent extends HTMLElement {
    constructor() {
        super();
        this.slides = Array.from(this.querySelectorAll('.hero-slider__slide'));
        this.prevButton = this.querySelector('.hero-slider__prev');
        this.nextButton = this.querySelector('.hero-slider__next');
        this.activeIndex = 0;
        this.isAnimating = false;
        this.loop = this.dataset.loop !== 'false';
        this.swipeEnabled = this.dataset.swipe !== 'false';
        this.onKeydown = this.onKeydown.bind(this);
    }

    connectedCallback() {
        if (!this.slides.length) return;

        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this.slides.length < 2) {
            this.slides[0].classList.add('is-active');
            this.slides[0].setAttribute('aria-hidden', 'false');
            this.prevButton?.setAttribute('hidden', '');
            this.nextButton?.setAttribute('hidden', '');
            this.dispatchSlideChange();
            return;
        }

        this.render();
        this.prevButton?.addEventListener('click', () => this.prev());
        this.nextButton?.addEventListener('click', () => this.next());
        this.addEventListener('keydown', this.onKeydown);
        if (this.swipeEnabled) this.setupSwipe();
        this.dispatchSlideChange();
    }

    onKeydown(event) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.prev();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.next();
        }
    }

    distanceTo(index) {
        const total = this.slides.length;
        let d = index - this.activeIndex;
        if (d > total / 2) d -= total;
        if (d < -total / 2) d += total;
        return d;
    }

    render() {
        this.slides.forEach((slide, i) => {
            const rawDistance = this.distanceTo(i);
            const clampedDistance = Math.max(-2, Math.min(2, rawDistance));
            slide.style.setProperty('--d', clampedDistance);
            slide.classList.toggle('is-active', rawDistance === 0);
            slide.classList.toggle('is-adjacent', Math.abs(rawDistance) === 1);
            slide.setAttribute('aria-hidden', rawDistance === 0 ? 'false' : 'true');
        });
    }

    goTo(index) {
        if (this.isAnimating) return;
        const total = this.slides.length;
        let target;
        if (this.loop) {
            target = ((index % total) + total) % total;
        } else {
            target = Math.max(0, Math.min(total - 1, index));
            if (target === this.activeIndex) return;
        }

        this.activeIndex = target;
        this.render();

        const finish = () => {
            this.isAnimating = false;
            this.dispatchSlideChange();
        };

        if (this.reducedMotion) {
            finish();
        } else {
            this.isAnimating = true;
            this.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 1200);
        }
    }

    next() {
        this.goTo(this.activeIndex + 1);
    }

    prev() {
        this.goTo(this.activeIndex - 1);
    }

    dispatchSlideChange() {
        const active = this.slides[this.activeIndex];
        this.dispatchEvent(
            new CustomEvent('slideChange', {
                detail: { index: this.activeIndex, handle: active?.dataset.handle },
            })
        );
    }

    setupSwipe() {
        let startX = 0;
        let startY = 0;
        let dragging = false;
        const threshold = 40;

        this.addEventListener('pointerdown', (event) => {
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
        });

        this.addEventListener('pointerup', (event) => {
            if (!dragging) return;
            dragging = false;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
                dx < 0 ? this.next() : this.prev();
            }
        });

        this.addEventListener('pointercancel', () => {
            dragging = false;
        });
    }
}

if (!customElements.get('hero-slider-component')) {
    customElements.define('hero-slider-component', HeroSliderComponent);
}

document.addEventListener('DOMContentLoaded', () => {
    const sliderEl = document.querySelector('.hero-slider__slider');
    const productCache = {};
    const LS_KEY = 'heroSliderProducts';
    const CACHE_TTL = 1000 * 60 * 60;

    if (!sliderEl) return;

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
        return Array.from(sliderEl.querySelectorAll('.hero-slider__slide'))
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

            const activeHandle = sliderEl.slides?.[sliderEl.activeIndex]?.dataset.handle;
            if (activeHandle && newCache[activeHandle]) {
                updateSlideInfo(activeHandle);
            }
            console.log('HeroSlider cache refreshed.');
        });
    }

    setInterval(refreshProductsIfChanged, 300000);

    sliderEl.addEventListener('slideChange', (event) => {
        const handle = event.detail.handle;
        if (handle) updateSlideInfo(handle);
    });

    const initialHandle = sliderEl.slides?.[sliderEl.activeIndex]?.dataset.handle;
    if (loadCacheFromStorage() && initialHandle && productCache[initialHandle]) {
        updateSlideInfo(initialHandle);
    }

    prefetchProducts().then(() => {
        const handle = sliderEl.slides?.[sliderEl.activeIndex]?.dataset.handle;
        if (handle) updateSlideInfo(handle);
    });
});

class RowSliderComponent extends HTMLElement {
    constructor() {
        super();
        this.viewport = this.querySelector('.row-slider__viewport');
        this.track = this.querySelector('.row-slider__track');
        this.prevButton = this.querySelector('.row-slider__prev');
        this.nextButton = this.querySelector('.row-slider__next');
        this.loop = this.dataset.loop !== 'false';
        this.autoplay = this.dataset.autoplay === 'true';
        this.autoplayDelay = parseInt(this.dataset.autoplayDelay, 10) || 3000;
        this.direction = this.dataset.direction === 'vertical' ? 'vertical' : 'horizontal';
        this.slidesDesktop = parseInt(this.dataset.slidesDesktop, 10) || 4;
        this.slidesMobile = parseInt(this.dataset.slidesMobile, 10) || 1;
        this._onScroll = this._onScroll.bind(this);
        this._scrollTimeout = null;
        this._resetting = false;
        this._autoplayTimer = null;
    }

    connectedCallback() {
        if (!this.viewport || !this.track) return;
        this.items = Array.from(this.track.children);
        if (!this.items.length) return;
        this.setup();
    }

    setup() {
        this.realCount = this.items.length;
        this.cloneCount = Math.min(this.realCount, Math.max(this.slidesDesktop, this.slidesMobile));

        if (this.loop && this.realCount > this.cloneCount) {
            this.buildClones();
        } else {
            this.cloneCount = 0;
        }

        this.prevButton?.addEventListener('click', () => this.step(-1));
        this.nextButton?.addEventListener('click', () => this.step(1));
        this.viewport.addEventListener('scroll', this._onScroll, { passive: true });

        if (this.autoplay) this.setupAutoplay();

        requestAnimationFrame(() => this.resetToStart());
    }

    buildClones() {
        const startClones = this.items.slice(-this.cloneCount).map((el) => this.makeClone(el));
        const endClones = this.items.slice(0, this.cloneCount).map((el) => this.makeClone(el));
        startClones.forEach((clone) => this.track.insertBefore(clone, this.track.firstChild));
        endClones.forEach((clone) => this.track.appendChild(clone));
    }

    makeClone(el) {
        const clone = el.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('tabindex', '-1');
        clone.classList.add('row-slider__item--clone');
        return clone;
    }

    get scrollProp() {
        return this.direction === 'vertical' ? 'scrollTop' : 'scrollLeft';
    }

    itemExtent() {
        const item = this.track.children[this.cloneCount] || this.track.children[0];
        if (!item) return 0;
        const rect = item.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(this.track).gap) || 0;
        return (this.direction === 'vertical' ? rect.height : rect.width) + gap;
    }

    resetToStart() {
        if (!this.loop || this.cloneCount === 0) return;
        this._resetting = true;
        this.viewport[this.scrollProp] = this.itemExtent() * this.cloneCount;
        requestAnimationFrame(() => {
            this._resetting = false;
        });
    }

    step(dir) {
        const extent = this.itemExtent();
        this.viewport.scrollBy({
            [this.direction === 'vertical' ? 'top' : 'left']: dir * extent,
            behavior: 'smooth',
        });
    }

    _onScroll() {
        if (this._resetting || !this.loop || this.cloneCount === 0) return;
        clearTimeout(this._scrollTimeout);
        this._scrollTimeout = setTimeout(() => this.checkBoundary(), 120);
    }

    checkBoundary() {
        const extent = this.itemExtent();
        if (!extent) return;
        const pos = this.viewport[this.scrollProp];
        const totalRealExtent = extent * this.realCount;
        const startBound = extent * this.cloneCount * 0.5;
        const endBound = extent * this.cloneCount + totalRealExtent + extent * this.cloneCount * 0.5;

        if (pos < startBound) {
            this._resetting = true;
            this.viewport[this.scrollProp] = pos + totalRealExtent;
            requestAnimationFrame(() => {
                this._resetting = false;
            });
        } else if (pos > endBound) {
            this._resetting = true;
            this.viewport[this.scrollProp] = pos - totalRealExtent;
            requestAnimationFrame(() => {
                this._resetting = false;
            });
        }
    }

    setupAutoplay() {
        this.addEventListener('mouseenter', () => this.pauseAutoplay());
        this.addEventListener('mouseleave', () => this.playAutoplay());
        this.addEventListener('focusin', () => this.pauseAutoplay());
        this.addEventListener('focusout', () => this.playAutoplay());
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) this.playAutoplay();
    }

    playAutoplay() {
        this.pauseAutoplay();
        this._autoplayTimer = setInterval(() => this.step(1), this.autoplayDelay);
    }

    pauseAutoplay() {
        clearInterval(this._autoplayTimer);
    }

    refresh() {
        this.track.querySelectorAll('.row-slider__item--clone').forEach((el) => el.remove());
        this.items = Array.from(this.track.children);
        if (!this.items.length) return;
        this.setup();
    }
}

if (!customElements.get('row-slider-component')) {
    customElements.define('row-slider-component', RowSliderComponent);
}

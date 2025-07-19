class AnnouncementSlider extends HTMLElement {
    connectedCallback() {
        this.container = this.querySelector('[data-slider]');
        if (!this.container) return;
        this.slides = Array.from(this.container.children);
        this.currentIndex = 0;
        this.speed = (parseInt(this.dataset.speed) || 5) * 1000;
        this.autoplay = this.dataset.autoplay === 'true';
        this.slides.forEach((slide, index) => {
            if (index !== this.currentIndex) slide.setAttribute('hidden', '');
        });
        if (this.autoplay && this.slides.length > 1) {
            this.start();
            this.addEventListener('mouseover', this.pause.bind(this));
            this.addEventListener('focusin', this.pause.bind(this));
            this.addEventListener('mouseleave', this.play.bind(this));
            this.addEventListener('focusout', this.play.bind(this));
        }
    }

    start() {
        this.interval = setInterval(this.next.bind(this), this.speed);
    }

    play() {
        if (this.interval) return;
        this.start();
    }

    pause() {
        clearInterval(this.interval);
        this.interval = null;
    }

    next() {
        this.slides[this.currentIndex].setAttribute('hidden', '');
        this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        this.slides[this.currentIndex].removeAttribute('hidden');
    }
}

customElements.define('announcement-slider', AnnouncementSlider);
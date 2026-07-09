import React, { useEffect, useState } from "react";

const EXIT_MS = 280;

const EmailPopup: React.FC = () => {
  const [show, setShow] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("emailSubscribed") === "true") return;
    if (localStorage.getItem("emailSubscribed") === "false") {
      setShowThankYou(false);
      return;
    }
    if (window.location.search.includes("customer_posted=true")) {
      localStorage.setItem("emailSubscribed", "true");
      setShowThankYou(true);
      return;
    }

    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!show && !showThankYou) {
      setIsVisible(false);
      return;
    }

    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [show, showThankYou]);

  const close = () => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);

    setTimeout(() => {
      setShow(false);
      setShowThankYou(false);
      setIsClosing(false);
    }, EXIT_MS);
  };

  if (!show && !showThankYou) return null;

  const overlayClass = [
    "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8",
    "bg-gray-900/30 backdrop-blur-sm",
    "transition-opacity duration-300 ease-out",
    isVisible ? "opacity-100" : "opacity-0",
  ].join(" ");

  const panelClass = [
    "relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl",
    "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
    isVisible
      ? "translate-y-0 scale-100 opacity-100"
      : "translate-y-4 scale-[0.97] opacity-0",
  ].join(" ");

  const reveal = (delay: string) =>
    [
      "transition-all duration-500",
      delay,
      isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
    ].join(" ");

  return (
    <div
      onClick={close}
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-popup-title"
    >
      <div onClick={(e) => e.stopPropagation()} className={panelClass}>
        <button
          type="button"
          onClick={close}
          aria-label="Close newsletter popup"
          className="absolute top-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-900 transition-all duration-200 hover:scale-110 hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {show && (
          <div className="flex flex-col md:flex-row">
            {/* Left panel — matches best-deal / footer dark sections */}
            <div
              className={[
                "flex flex-col items-center justify-center gap-5 bg-gray-800 px-10 py-12 text-center md:w-[42%] md:px-10 md:py-16",
                reveal("delay-75"),
              ].join(" ")}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-700/60 text-gray-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-10 w-10"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <span className="text-[14px] font-light uppercase tracking-widest text-gray-300">
                  Newsletter
                </span>
                <p className="text-[20px] font-semibold leading-snug text-gray-100">
                  Curated for your modern interior
                </p>
              </div>
            </div>

            {/* Right panel — form */}
            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-12 sm:px-12 sm:py-14">
              <div className={["space-y-3 text-center", reveal("delay-150")].join(" ")}>
                <h2
                  id="email-popup-title"
                  className="text-[28px] font-semibold text-gray-900"
                >
                  Subscribe for Updates
                </h2>
                <p className="max-w-sm text-[14px] leading-relaxed text-gray-600">
                  Get our latest news, new arrivals, and exclusive sales delivered to your inbox.
                </p>
              </div>

              <div className={["w-full max-w-md", reveal("delay-300")].join(" ")}>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      document.getElementById("emailPopupForm")?.innerHTML || "",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {showThankYou && (
          <div className="flex flex-col items-center gap-8 px-10 py-16 sm:px-16 sm:py-20">
            <div
              className={[
                "flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 text-gray-800",
                reveal("delay-75"),
                isVisible ? "scale-100" : "scale-90",
              ].join(" ")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className={["space-y-3 text-center", reveal("delay-200")].join(" ")}>
              <h2 className="text-[28px] font-semibold text-gray-900">
                You&apos;re all set!
              </h2>
              <p className="text-[14px] text-gray-600">
                Thanks for subscribing. We&apos;ll be in touch with the latest from our collection.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailPopup;

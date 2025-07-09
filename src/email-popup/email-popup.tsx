import React, { useEffect, useState } from "react";

const EmailPopup: React.FC = () => {
  const [show, setShow] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

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

  const close = () => {
    setShow(false);
    setShowThankYou(false);
  };

  if (!show && !showThankYou) return null;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-[50vw] h-[50vh] p-10 rounded-lg shadow-xl text-center flex flex-col items-center justify-center gap-5">
        <button
          onClick={close}
          className="absolute top-2 right-2 text-gray-500 hover:text-black text-2xl"
        >
          &times;
        </button>

        {show && (
          <>
            <h2 className="text-2xl font-bold mb-4">📬 Subscribe for Updates</h2>
            <p className="text-gray-600 mb-4">Get our latest news and sales!</p>
            <div className="w-full"
              dangerouslySetInnerHTML={{
                __html:
                  document.getElementById("emailPopupForm")?.innerHTML || "",
              }}
            />
          </>
        )}

        {showThankYou && (
          <>
            <h2 className="text-2xl font-bold mb-4">🎉 Thank You!</h2>
            <p className="text-gray-700">You're now subscribed.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailPopup;

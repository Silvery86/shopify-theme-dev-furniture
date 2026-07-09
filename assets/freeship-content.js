function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() + 5);
const endDate = new Date(today);
endDate.setDate(today.getDate() + 10);

const dateRangeText = `${formatDate(startDate)} – ${formatDate(endDate)}`;

function renderShippingDateRange() {
    const el = document.getElementById('shipping-date-range');
    if (el) el.textContent = dateRangeText;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderShippingDateRange);
} else {
    renderShippingDateRange();
}

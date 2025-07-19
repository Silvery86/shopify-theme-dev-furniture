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
document.getElementById('shipping-date-range').textContent = dateRangeText;

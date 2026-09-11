'use strict';
// Preserve the checkout path, including its literal plus sign.
// Only campaign attribution parameters are forwarded; no form data is collected.
const campaignKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src'];
const incoming = new URLSearchParams(window.location.search);
document.querySelectorAll('a.checkout').forEach((link) => {
  const destination = new URL(link.href);
  campaignKeys.forEach((key) => {
    const value = incoming.get(key);
    if (value && value.length <= 500) destination.searchParams.set(key, value);
  });
  link.href = destination.toString();
});
const checkoutFrame = document.querySelector('.checkout-frame');
if (checkoutFrame) {
  const destination = new URL(checkoutFrame.src);
  campaignKeys.forEach((key) => {
    const value = incoming.get(key);
    if (value && value.length <= 500) destination.searchParams.set(key, value);
  });
  checkoutFrame.src = destination.toString();
}
document.getElementById('year').textContent = String(new Date().getFullYear());

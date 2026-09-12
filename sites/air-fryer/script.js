'use strict';
// Mantém a atribuição do anúncio do primeiro clique até o Pix.
const attributionKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','fbclid'];
const incoming = new URLSearchParams(window.location.search);
const visitKey = 'trendou_visit_id';
const validVisitId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
let visitId = incoming.get('visit_id') || sessionStorage.getItem(visitKey) || '';
if (!validVisitId(visitId)) visitId = crypto.randomUUID();
sessionStorage.setItem(visitKey, visitId);

function withAttribution(url) {
  const destination = new URL(url, window.location.origin);
  attributionKeys.forEach((key) => {
    const value = incoming.get(key);
    if (value && value.length <= 500) destination.searchParams.set(key, value);
  });
  destination.searchParams.set('visit_id', visitId);
  return destination.toString();
}

document.querySelectorAll('a.checkout').forEach((link) => {
  link.href = withAttribution(link.getAttribute('href') || link.href);
});
const checkoutFrame = document.querySelector('.checkout-frame');
if (checkoutFrame) checkoutFrame.src = withAttribution(checkoutFrame.getAttribute('src') || checkoutFrame.src);

document.getElementById('year').textContent = String(new Date().getFullYear());

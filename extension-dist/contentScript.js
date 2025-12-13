// Content script: extract listing elements and send axieId + price to background
(function() {
  function extractListings() {
    const items = Array.from(document.querySelectorAll('[data-testid="marketplace-listing"]'));
    if (!items.length) {
      const rows = Array.from(document.querySelectorAll('.MarketplaceListing, .ListingCard'));
      return rows.map(el => ({ el, id: extractIdFromElement(el), price: extractPriceFromElement(el) }));
    }
    return items.map(el => ({ el, id: extractIdFromElement(el), price: extractPriceFromElement(el) }));
  }

  function extractIdFromElement(el) {
    try {
      const link = el.querySelector('a')?.href || el.dataset?.axieId;
      if (!link) return null;
      const m = link.match(/(0x[0-9a-fA-F]{40}|\d+)/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  function extractPriceFromElement(el) {
    try {
      const priceEl = el.querySelector('.price') || el.querySelector('.ListingPrice') || el.querySelector('[data-price]');
      if (!priceEl) return null;
      const text = priceEl.textContent || priceEl.innerText || '';
      const m = text.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)/);
      return m ? Number(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function annotateElement(el, signal, valuation) {
    if (!el) return;
    const badge = document.createElement('div');
    badge.style.position = 'absolute';
    badge.style.zIndex = 9999;
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '6px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '600';
    badge.style.color = '#fff';
    badge.style.pointerEvents = 'none';

    if (signal === 'undervalued') {
      badge.style.background = 'linear-gradient(90deg,#0ea5a4,#059669)';
      badge.textContent = `Undervalued $${valuation.valuation.estimatedValue}`;
    } else if (signal === 'overvalued') {
      badge.style.background = 'linear-gradient(90deg,#fb923c,#f97316)';
      badge.textContent = `Overvalued $${valuation.valuation.estimatedValue}`;
    } else if (signal === 'fair') {
      badge.style.background = 'linear-gradient(90deg,#60a5fa,#3b82f6)';
      badge.textContent = `Fair $${valuation.valuation.estimatedValue}`;
    } else {
      badge.style.background = 'rgba(0,0,0,0.6)';
      badge.textContent = `Valuation unknown`;
    }

    el.style.position = el.style.position || 'relative';
    badge.style.top = '8px';
    badge.style.right = '8px';
    badge.style.float = 'right';
    el.appendChild(badge);
  }

  async function processListings() {
    const items = extractListings();
    for (const item of items) {
      try {
        if (!item.id) continue;
        const resp = await chrome.runtime.sendMessage({ type: 'getValuation', axieId: item.id, listingPrice: item.price });
        if (resp && resp.success && resp.data) {
          annotateElement(item.el, resp.data.signal, resp.data);
        }
      } catch (e) {
        // ignore per-item errors
      }
    }
  }

  processListings();

  const observer = new MutationObserver((mutations) => {
    clearTimeout(window.__axievale_mutation_timeout);
    window.__axievale_mutation_timeout = setTimeout(processListings, 400);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
